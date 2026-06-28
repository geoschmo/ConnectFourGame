# ConnectFourGame

ASP.NET Core 8 Razor Pages Connect Four game with local, CPU, and invite-link multiplayer modes.

## Play Online

🎮 **Play ConnectFour:** [Launch the game](https://georgeperley.com/connectfour)

## Features

- Player vs computer mode with three difficulty levels
- Local two-player mode
- Remote two-player rooms using SignalR
- Responsive browser UI

## Local run

```powershell
dotnet run --project .\ConnectFourGame\ConnectFourGame.csproj
```

## Configuration

Optional app settings:

- `PathBase`: virtual application path when hosted under a subpath
- `PortfolioUrl`: URL used by the back-to-portfolio link
