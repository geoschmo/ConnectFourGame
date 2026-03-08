# ConnectFourGame

ASP.NET Core 8 Razor Pages Connect Four game, intended to run at `https://georgeperley.com/connectfour`.

## Local run

```powershell
dotnet run --project .\ConnectFourGame\ConnectFourGame.csproj
```

## Deployment

GitHub Actions deploys this app to SmarterASP.NET on pushes to `master` using Web Deploy.

Repository variables:

- `MSDEPLOY_SITE`: SmarterASP site name, such as `geoschmo-001-site2`
- `MSDEPLOY_URL`: Web Deploy endpoint, such as `https://win8127.site4now.net:8172/msdeploy.axd?site=geoschmo-001-site2`
- `MSDEPLOY_USER`: SmarterASP publish username
- `MSDEPLOY_APP_PATH`: virtual app folder, set to `connectfour`

Repository secret:

- `MSDEPLOY_PASS`: SmarterASP publish password
