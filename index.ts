import { Client } from "@notionhq/client"
import { InputPropertyValueMap } from "@notionhq/client/build/src/api-endpoints"
import { SelectPropertyValue, TitlePropertyValue } from "@notionhq/client/build/src/api-types"

import { config } from "dotenv"
import { Octokit } from "octokit"

config()

const octokit = new Octokit({ auth: process.env["GITHUB_KEY"] })
const notion = new Client({ auth: process.env["NOTION_KEY"] })

const database_id = process.env["NOTION_DATABASE_ID"]
const PROPERTY_STATUS = process.env["PROPERTY_STATUS"]
const PROPERTY_TITLE = process.env["PROPERTY_TITLE"]
const PROPERTY_NO = process.env["PROPERTY_NO"]
const PROPERTY_GITHUB = process.env["PROPERTY_GITHUB"]

async function createGitHubIssues(tasks: Page[]) {
  tasks.forEach(async (task) => {
    const createdIssue = await octokit.rest.issues.create({ 
      owner: process.env["GITHUB_OWNER"],
      repo: process.env["GITHUB_REPO"],
      title: task.Title,
      body: task.Url
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

     notion.pages.update({page_id: task.Id, properties: propertyValues })
  })
}

async function main() {
  const tasks = await getTasksFromDatabase()
  console.log(tasks)
  createGitHubIssues(tasks).catch(console.error)
}

type Page = {
  Id: string
  Status: string
  Title: string
  Url: string
}

async function getTasksFromDatabase() {
  const tasks: Page[] = []

  async function getPageOfTasks(cursor: string | null) {

    const current_pages = await notion.databases.query({
      database_id: database_id, 
      filter: {
        property: PROPERTY_NO,
        number: {
          is_empty: true
        },
      },
      start_cursor: cursor
    })

    for (const page of current_pages.results) {
      if (page.object === 'page') {
        tasks.push({
          Id: page.id,
          Status: (page.properties[PROPERTY_STATUS] as SelectPropertyValue).select.name,
          Title: (page.properties[PROPERTY_TITLE] as TitlePropertyValue).title[0]!.plain_text,
          Url: page.url,
        })
      }
    }
    if (current_pages.has_more) {
      await getPageOfTasks(current_pages.next_cursor)
    }
  }
  await getPageOfTasks(undefined)
  return tasks
}

main()
