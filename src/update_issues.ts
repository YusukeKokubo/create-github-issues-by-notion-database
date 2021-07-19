import { Client } from "@notionhq/client"
import { NumberPropertyValue, SelectPropertyValue, TitlePropertyValue } from "@notionhq/client/build/src/api-types"
import { formatISO, subDays } from "date-fns"

import { config } from "dotenv"
import { Octokit } from "octokit"

config()

const octokit = new Octokit({ auth: process.env["REPO_GITHUB_TOKEN"] })
const notion = new Client({ auth: process.env["NOTION_KEY"] })

const DATABASE_ID = process.env["NOTION_DATABASE_ID"]
const PROPERTY_TITLE = process.env["PROPERTY_TITLE"]
const PROPERTY_NO = process.env["PROPERTY_NO"]
const PROPERTY_UPDATE_TARGET_DAYS = Number(process.env["PROPERTY_UPDATE_TARGET_DAYS"])
const PROPERTY_STATUS = process.env["PROPERTY_STATUS"]
const PROPERTY_VALUE_STATUS_DONE = process.env["PROPERTY_VALUE_STATUS_DONE"]
const PROPERTY_UPDATED_TIME = process.env["PROPERTY_UPDATED_TIME"]


type Page = {
  id: string
  title: string
  status: string
  issue_number: number
}

async function updateGitHubIssues(tasks: Page[]) {
  for (const [index, task] of Object.entries(tasks)) {
    const state = task.status === PROPERTY_VALUE_STATUS_DONE ? 'closed' : 'open'

    const updatedIssue = await octokit.rest.issues.update({
      owner: process.env["REPO_GITHUB_OWNER"],
      repo: process.env["REPO_GITHUB_REPO"],
      issue_number: task.issue_number,
      title: task.title,
      state: state,
    })

    console.log('updated', task.title, updatedIssue.data.number)

    // TODO: I'd really like to sleep here.(to avoid GitHub's api rate limit)
  }
}

async function getDoneTasksFromDatabase() {
  const doneTasks: Page[] = []
  const past_days = formatISO(subDays(new Date(), PROPERTY_UPDATE_TARGET_DAYS))

  async function getPageOfTasks(cursor: string | null) {
    const current_pages = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: PROPERTY_UPDATED_TIME,
        date: {
          after: past_days
        }
      },
      start_cursor: cursor
    })
    console.log('pages count: ', current_pages.results.length)

    for (const page of current_pages.results) {
      if (page.object === 'page') {
        const title = page.properties[PROPERTY_TITLE] as TitlePropertyValue
        const status = page.properties[PROPERTY_STATUS] as SelectPropertyValue
        const issue_number = page.properties[PROPERTY_NO] as NumberPropertyValue
        if (title && title.title.length > 0) {
          doneTasks.push({
            id: page.id,
            title: title.title[0].plain_text,
            status: status.select.name,
            issue_number: issue_number.number,
          })
        }
      }
    }
    if (current_pages.has_more) {
      await getPageOfTasks(current_pages.next_cursor)
    }
  }
  await getPageOfTasks(undefined)
  return doneTasks
}

async function main() {
  const tasks = await getDoneTasksFromDatabase()
  console.log(tasks)
  updateGitHubIssues(tasks).catch(console.error)
}
main()
