using ConnectFourGame.Services;
using Microsoft.AspNetCore.SignalR;

namespace ConnectFourGame.Hubs;

public sealed class GameHub : Hub
{
    private readonly ConnectFourRoomService roomService;

    public GameHub(ConnectFourRoomService roomService)
    {
        this.roomService = roomService;
    }

    public async Task<object> CreateRoom()
    {
        var room = roomService.CreateRoom(Context.ConnectionId);
        await Groups.AddToGroupAsync(Context.ConnectionId, room.RoomCode);

        return new
        {
            success = true,
            roomCode = room.RoomCode,
            playerColor = "R",
            playerToken = room.RedToken,
            state = roomService.BuildState(room)
        };
    }

    public async Task<object> JoinRoom(string roomCode, string? playerToken = null)
    {
        var result = roomService.JoinRoom(roomCode.ToUpperInvariant(), Context.ConnectionId, playerToken);
        if (!result.Success || result.Room is null || result.PlayerColor is null || result.PlayerToken is null)
        {
            return new
            {
                success = false,
                message = result.Message ?? "Unable to join room."
            };
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, result.Room.RoomCode);
        await Clients.Group(result.Room.RoomCode).SendAsync("GameStateUpdated", roomService.BuildState(result.Room));

        return new
        {
            success = true,
            roomCode = result.Room.RoomCode,
            playerColor = result.PlayerColor,
            playerToken = result.PlayerToken,
            state = roomService.BuildState(result.Room)
        };
    }

    public async Task<object> DropDisc(int column)
    {
        var room = roomService.GetRoomByConnection(Context.ConnectionId);
        if (room is null)
        {
            return new { success = false, message = "Room not found." };
        }

        string? playerColor;
        bool moved;
        string? error;

        lock (room.SyncRoot)
        {
            playerColor = room.GetPlayerColor(Context.ConnectionId);
            if (playerColor is null)
            {
                return new { success = false, message = "You are not assigned to this room." };
            }

            moved = room.TryDropDisc(playerColor, column, out _, out error);
        }

        if (!moved)
        {
            return new { success = false, message = error ?? "Move rejected." };
        }

        await Clients.Group(room.RoomCode).SendAsync("GameStateUpdated", roomService.BuildState(room));

        return new { success = true };
    }

    public async Task<object> RestartGame()
    {
        var room = roomService.GetRoomByConnection(Context.ConnectionId);
        if (room is null)
        {
            return new { success = false, message = "Room not found." };
        }

        lock (room.SyncRoot)
        {
            if (room.GetPlayerColor(Context.ConnectionId) is null)
            {
                return new { success = false, message = "You are not assigned to this room." };
            }

            room.ResetBoard();
        }

        await Clients.Group(room.RoomCode).SendAsync("GameStateUpdated", roomService.BuildState(room));
        return new { success = true };
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var room = roomService.GetRoomByConnection(Context.ConnectionId);
        roomService.RemoveConnection(Context.ConnectionId);

        if (room is not null)
        {
            await Clients.Group(room.RoomCode).SendAsync("GameStateUpdated", roomService.BuildState(room));
        }

        await base.OnDisconnectedAsync(exception);
    }
}
