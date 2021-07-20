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
  lastEditedTime: string
}

async function updateGitHubIssues(tasks: Page[]) {
  for (const [index, task] of Object.entries(tasks)) {
    const state = PROPERTY_VALUE_STATUS_DONE.split(',').includes(task.status) ? 'closed' : 'open'

    const updatedIssue = await octokit.rest.issues.update({
      owner: process.env["REPO_GITHUB_OWNER"],
      repo: process.env["REPO_GITHUB_REPO"],
      issue_number: task.issue_number,
      title: task.title,
      state: state,
    })

    // console.log('updated', task.title, task.issue_number, state)
    console.log('updated', updatedIssue.data.title, updatedIssue.data.number, updatedIssue.data.state)

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
        and: [
          {
            property: PROPERTY_UPDATED_TIME,
            date: {
              after: past_days
            },
          },
          {
            property: PROPERTY_TITLE,
            text: {
              is_not_empty: true
            }
          },
          {
            property: PROPERTY_STATUS,
            select: {
              is_not_empty: true
            }
          },
          {
            property: PROPERTY_NO,
            number: {
              is_not_empty: true
            }
          }
        ],
      },
      start_cursor: cursor
    })
    console.log('pages count: ', current_pages.results.length)

    for (const page of current_pages.results) {
      if (page.object === 'page') {
        // console.debug(page.properties)
        const title = page.properties[PROPERTY_TITLE] as TitlePropertyValue
        const status = page.properties[PROPERTY_STATUS] as SelectPropertyValue
        const issue_number = page.properties[PROPERTY_NO] as NumberPropertyValue
        doneTasks.push({
          id: page.id,
          title: title.title[0].plain_text,
          status: status.select.name,
          issue_number: issue_number.number,
          lastEditedTime: page.last_edited_time
        })
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
