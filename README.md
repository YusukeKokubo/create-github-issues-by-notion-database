## About the Integration

- Create GitHub issues by Notion pages in a database.
- Add a link and back-link between GitHub Issues and Notion pages.

## Running Locally

### 1. Setup your local project

```zsh
git clone [url]
npm install
```

### 2. Set your environment variables in a `.env` file

```zsh
NOTION_KEY= <your-notion-api-key>
NOTION_DATABASE_ID=<your-notion-database-id>
GITHUB_KEY=<your-github-token>
GITHUB_OWNER=<your-github-owner>
GITHUB_REPO=<your-github-repository>

PROPERTY_STATUS=<status-for-your-tasks-in-database>
PROPERTY_TITLE=<title-for-your-tasks-in-database>
PROPERTY_NO=<property-name-for-github-issues-no>
PROPERTY_GITHUB=<property-name-for-github-issue-url>
```

You can create your Notion API key [here](https://www.notion.com/my-integrations).

### 3. Run code

```zsh
npm run ts-run
```
