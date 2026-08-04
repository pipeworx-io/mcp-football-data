# @pipeworx/football-data

football-data.org MCP — soccer competitions, matches, standings, teams.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

- `list_competitions()`
- `get_competition_matches(competition, status?, date_from?, date_to?, matchday?, stage?, season?)`
- `get_competition_standings(competition, season?, matchday?)`
- `get_team(team_id)`
- `get_team_matches(team_id, status?, date_from?, date_to?, venue?, season?, limit?)`

## Auth

- **Platform key:** gateway env `PLATFORM_FOOTBALL_DATA_KEY`.
- **BYO:** `?_apiKey=<token>` after registering at https://www.football-data.org/client/register (free, 10 req/min).

## Data source

`https://api.football-data.org/v4/` — header `X-Auth-Token`.

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "football-data": {
      "url": "https://gateway.pipeworx.io/football-data/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Football Data data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
