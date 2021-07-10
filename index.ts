import { Client } from "@notionhq/client"
import { InputPropertyValueMap } from "@notionhq/client/build/src/api-endpoints"
import { SelectPropertyValue, TitlePropertyValue } from "@notionhq/client/build/src/api-types"

import { config } from "dotenv"
import { Octokit } from "octokit"

config()

const octokit = new Octokit({ auth: process.env["GITHUB_KEY"] })
const notion = new Client({ auth: process.env["NOTION_KEY"] })

const database_id = process.env["NOTION_DATABASE_ID"]

async function createGitHubIssues(tasks: Page[]) {
  tasks.forEach(async (task) => {
    const createdIssue = await octokit.rest.issues.create({ 
      owner: process.env["GITHUB_OWNER"],
      repo: process.env["GITHUB_REPO"],
      title: task.Title,
      body: task.Url
     })

     const propertyValues: InputPropertyValueMap = {}
     propertyValues['No'] = {
       type: 'number',
       number: createdIssue.data.number
     }
     propertyValues['GitHub'] = {
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
        property: "No",
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
          Status: (page.properties["Status"] as SelectPropertyValue).select.name,
          Title: (page.properties["Name"] as TitlePropertyValue).title[0]!.plain_text,
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
