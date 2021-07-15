import { Client } from "@notionhq/client"
import { InputPropertyValueMap } from "@notionhq/client/build/src/api-endpoints"
import { TitlePropertyValue } from "@notionhq/client/build/src/api-types"

import { config } from "dotenv"
import { Octokit } from "octokit"

config()

const octokit = new Octokit({ auth: process.env["REPO_GITHUB_TOKEN"] })
const notion = new Client({ auth: process.env["NOTION_KEY"] })

const DATABASE_ID = process.env["NOTION_DATABASE_ID"]
const PROPERTY_TITLE = process.env["PROPERTY_TITLE"]
const PROPERTY_NO = process.env["PROPERTY_NO"]
const PROPERTY_GITHUB = process.env["PROPERTY_GITHUB"]

type Page = {
  id: string
  title: string
  url: string
}

async function createGitHubIssues(tasks: Page[]) {
  for (const [index, task] of Object.entries(tasks)) {
    const createdIssue = await octokit.rest.issues.create({
      owner: process.env["REPO_GITHUB_OWNER"],
      repo: process.env["REPO_GITHUB_REPO"],
      title: task.title,
      body: task.url
    })

    const propertyValues: InputPropertyValueMap = {}
    propertyValues[PROPERTY_NO] = {
      type: 'number',
      number: createdIssue.data.number
    }
    propertyValues[PROPERTY_GITHUB] = {
      type: 'url',
      url: createdIssue.data.html_url
    }

    notion.pages.update({ page_id: task.id, properties: propertyValues, archived: false })
    console.log('created', task.title, createdIssue.data.number)

    // TODO: I'd really like to sleep here.(to avoid GitHub's api rate limit)
  }
}

async function getTasksFromDatabase() {
  const tasks: Page[] = []
  async function getPageOfTasks(cursor: string | null) {
    const current_pages = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: PROPERTY_NO,
        number: {
          is_empty: true
        },
      },
      start_cursor: cursor
    })
    console.log('pages count: ', current_pages.results.length)

    for (const page of current_pages.results) {
      if (page.object === 'page') {
        if (page.properties[PROPERTY_TITLE] && (page.properties[PROPERTY_TITLE] as TitlePropertyValue).title[0]) {
          tasks.push({
            id: page.id,
            title: (page.properties[PROPERTY_TITLE] as TitlePropertyValue).title[0].plain_text,
            url: page.url,
          })
        }
      }
    }
    if (current_pages.has_more) {
      await getPageOfTasks(current_pages.next_cursor)
    }
  }
  await getPageOfTasks(undefined)
  return tasks
}

async function main() {
  const tasks = await getTasksFromDatabase()
  console.log(tasks)
  createGitHubIssues(tasks).catch(console.error)
}
main()
