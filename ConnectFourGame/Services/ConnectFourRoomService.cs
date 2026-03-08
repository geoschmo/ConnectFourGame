using System.Collections.Concurrent;
using ConnectFourGame.Models;

namespace ConnectFourGame.Services;

public sealed class ConnectFourRoomService
{
    private static readonly char[] RoomAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".ToCharArray();
    private readonly ConcurrentDictionary<string, ConnectFourRoom> rooms = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, string> connectionToRoom = new(StringComparer.Ordinal);
    private readonly Random random = new();

    public ConnectFourRoom CreateRoom(string connectionId)
    {
        while (true)
        {
            var roomCode = GenerateRoomCode();
            var room = new ConnectFourRoom(roomCode, connectionId);

            if (rooms.TryAdd(roomCode, room))
            {
                connectionToRoom[connectionId] = roomCode;
                return room;
            }
        }
    }

    public JoinRoomResult JoinRoom(string roomCode, string connectionId, string? playerToken)
    {
        if (!rooms.TryGetValue(roomCode, out var room))
        {
            return JoinRoomResult.CreateFailure("Room not found.");
        }

        lock (room.SyncRoot)
        {
            if (!string.IsNullOrWhiteSpace(playerToken))
            {
                var existingColor = room.GetPlayerColorByToken(playerToken);
                if (existingColor is not null)
                {
                    var oldConnectionId = existingColor == "R" ? room.RedConnectionId : room.YellowConnectionId;
                    if (!string.IsNullOrWhiteSpace(oldConnectionId))
                    {
                        connectionToRoom.TryRemove(oldConnectionId, out _);
                    }

                    room.ReconnectPlayer(existingColor, connectionId);
                    connectionToRoom[connectionId] = room.RoomCode;
                    return JoinRoomResult.CreateSuccess(room, existingColor, playerToken);
                }
            }

            if (string.IsNullOrWhiteSpace(room.RedConnectionId))
            {
                room.ReconnectPlayer("R", connectionId);
                connectionToRoom[connectionId] = room.RoomCode;
                return JoinRoomResult.CreateSuccess(room, "R", room.RedToken);
            }

            if (string.IsNullOrWhiteSpace(room.YellowConnectionId))
            {
                var token = room.AssignYellowPlayer(connectionId);
                connectionToRoom[connectionId] = room.RoomCode;
                return JoinRoomResult.CreateSuccess(room, "Y", token);
            }

            return JoinRoomResult.CreateFailure("Room is full.");
        }
    }

    public ConnectFourRoom? GetRoomByConnection(string connectionId)
    {
        if (!connectionToRoom.TryGetValue(connectionId, out var roomCode))
        {
            return null;
        }

        rooms.TryGetValue(roomCode, out var room);
        return room;
    }

    public void RemoveConnection(string connectionId)
    {
        if (!connectionToRoom.TryRemove(connectionId, out var roomCode))
        {
            return;
        }

        if (!rooms.TryGetValue(roomCode, out var room))
        {
            return;
        }

        lock (room.SyncRoot)
        {
            room.RemoveConnection(connectionId);

            if (string.IsNullOrWhiteSpace(room.RedConnectionId)
                && string.IsNullOrWhiteSpace(room.YellowConnectionId))
            {
                rooms.TryRemove(room.RoomCode, out _);
            }
        }
    }

    public object BuildState(ConnectFourRoom room)
    {
        lock (room.SyncRoot)
        {
            return new
            {
                roomCode = room.RoomCode,
                board = room.Board,
                currentPlayer = room.CurrentPlayer,
                gameOver = room.GameOver,
                winner = room.Winner,
                winningCells = room.WinningCells,
                redConnected = !string.IsNullOrWhiteSpace(room.RedConnectionId),
                yellowConnected = !string.IsNullOrWhiteSpace(room.YellowConnectionId),
                hasTwoPlayers = room.HasTwoPlayers
            };
        }
    }

    private string GenerateRoomCode()
    {
        lock (random)
        {
            return new string(Enumerable.Range(0, 6)
                .Select(_ => RoomAlphabet[random.Next(RoomAlphabet.Length)])
                .ToArray());
        }
    }
}

public sealed record JoinRoomResult(bool Success, string? Message, ConnectFourRoom? Room, string? PlayerColor, string? PlayerToken)
{
    public static JoinRoomResult CreateFailure(string message) => new(false, message, null, null, null);

    public static JoinRoomResult CreateSuccess(ConnectFourRoom room, string playerColor, string playerToken)
        => new(true, null, room, playerColor, playerToken);
}
