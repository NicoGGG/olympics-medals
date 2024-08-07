# Olympics France Medals Tracker

A simple stack using kafka and nodejs to keep track of the number of medals won by France, and send a discord notification when new ones are added

## Quickstart

Create a .env file and set the DISCORD_WEBHOOK url, or set it in the notification service in `docker-compose.yml`

```.env
DISCORD_WEBHOOK=https://discord.com/api/webhooks/123456789/abcdefgHIJKLMNOP123456789
```

[How to create a discord webhook for one of your channels](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks)

Using node and docker-compose

```bash
npm install
docker compose up -d --build
```

First run will create a new document for the medals. All subsequent runs will trigger a notifications if there are differences with current state

You can set the `SCAN_INTERVAL_MS` variable (default 300000) to set the frequence of checking for new result

> [!NOTE]
> Try not to spam to avoid being blacklisted from the olympics website
