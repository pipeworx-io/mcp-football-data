# mcp-football-data

Football-Data.org MCP — soccer competitions, matches, standings

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 673+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `get_competition_standings` | League table for a competition season. Returns total / home / away tables. |
| `get_team` | Team detail by ID — current squad, coach, competitions, venue. |
| `get_team_matches` | A team\'s matches across competitions. Filter by status, date range, competitions, season, or venue. |

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

Or connect to the full Pipeworx gateway for access to all 673+ data sources:

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

- [All tools and guides](https://github.com/pipeworx-io/examples)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
