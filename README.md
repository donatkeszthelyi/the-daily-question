# The Daily Question

A minimal daily trivia application that presents one multiple-choice question each day. The application is available on this link: [The Daily Question](https://daily.donatkeszthelyi.com/).

Built with vanilla JavaScript, Cloudflare Workers and Cloudflare D1. Questions are provided by the [Open Trivia Database](https://opentdb.com/).

## Features

- One shared daily question for all visitors.
- Questions are retrieved from the Open Trivia Database.
- Answer choices are shuffled into a consistent order for each daily question.
- The same answer order is served to every visitor.
- Answers are checked by the backend.
- A visitor's submitted answer is remembered in their browser.
- Previously used questions are not repeated.
- Minimal, responsive interface.

## Technology

- HTML
- CSS
- Vanilla JavaScript
- Cloudflare Workers
- Cloudflare D1
- Open Trivia Database API

## Project Structure

```text
the-daily-question/
├── public/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── favicon.svg
├── worker/
│   └── index.js
├── wrangler.toml
└── README.md
```

The Wrangler configuration file may use a different supported format, such as `wrangler.jsonc`.

## How It Works

The application uses a Cloudflare Worker to serve the frontend and handle API requests.

1. The Worker retrieves or assigns the daily question.
2. The selected question is shared across all visitors.
3. Answer choices are shuffled deterministically using the question ID and date as a seed.
4. The Worker returns the question and answer choices to the frontend.
5. When a visitor selects an answer, the frontend sends it to the Worker for validation.
6. The Worker checks the submitted answer and returns the result.
7. The frontend stores the visitor's answer in local storage to restore their result when they return.

Questions are stored in Cloudflare D1 to support daily assignment and prevent previously used questions from being selected again.

## API Endpoints

### Get the daily question

`GET /api/daily-question`

Returns the question assigned for the current day, including its answer choices.

### Submit an answer

`POST /api/answer`

Request body:

```json
{
  "questionId": "QUESTION_ID",
  "answer": "SELECTED_ANSWER"
}
```

The Worker validates the submitted answer and returns the result.

## Local Development

### Requirements

- Node.js
- npm
- A Cloudflare account
- Wrangler CLI

### Install dependencies

If the project has a `package.json`, install its dependencies:

```bash
npm install
```

If Wrangler is not installed as a project dependency, it can be run using `npx`.

### Configure Cloudflare

Make sure your Wrangler configuration contains:

- The Worker entry point.
- The `public/` directory as the static assets directory.
- A D1 database binding named `trivia_db`.
- The correct D1 database configuration.

The Worker uses the `trivia_db` binding to access the database.

### Run locally

```bash
npx wrangler dev
```

Open:

`http://localhost:8787`

## Deployment

Authenticate with Cloudflare:

```bash
npx wrangler login
```

Deploy the application:

```bash
npx wrangler deploy
```

Cloudflare will provide a deployment URL. A custom domain can be configured through the Worker settings in the Cloudflare dashboard.

## Attribution

Trivia questions are provided by the [Open Trivia Database](https://opentdb.com/) and its contributors.

Question content is licensed under [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).

Answer choices are shuffled for presentation. This project is not affiliated with or endorsed by Open Trivia Database.

## License

The licence for the application source code has not been specified.

The trivia content is subject to the Open Trivia Database's CC BY-SA 4.0 licence. See the attribution section above for details.
