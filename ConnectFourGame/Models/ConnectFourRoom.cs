namespace ConnectFourGame.Models;

public sealed class ConnectFourRoom
{
    public const int Rows = 6;
    public const int Columns = 7;

    public ConnectFourRoom(string roomCode, string redConnectionId)
    {
        RoomCode = roomCode;
        RedConnectionId = redConnectionId;
        RedToken = Guid.NewGuid().ToString("N");
        ResetBoard();
    }

    public object SyncRoot { get; } = new();

    public string RoomCode { get; }

    public string RedToken { get; }

    public string? YellowToken { get; private set; }

    public string? RedConnectionId { get; private set; }

    public string? YellowConnectionId { get; private set; }

    public string?[][] Board { get; private set; } = [];

    public string CurrentPlayer { get; private set; } = "R";

    public bool GameOver { get; private set; }

    public string? Winner { get; private set; }

    public List<int[]> WinningCells { get; private set; } = [];

    public bool HasTwoPlayers => !string.IsNullOrWhiteSpace(RedConnectionId) && !string.IsNullOrWhiteSpace(YellowConnectionId);

    public string AssignYellowPlayer(string connectionId)
    {
        YellowConnectionId = connectionId;
        YellowToken ??= Guid.NewGuid().ToString("N");
        return YellowToken;
    }

    public void ReconnectPlayer(string color, string connectionId)
    {
        if (color == "R")
        {
            RedConnectionId = connectionId;
            return;
        }

        YellowConnectionId = connectionId;
    }

    public string? GetPlayerColor(string connectionId)
    {
        if (RedConnectionId == connectionId)
        {
            return "R";
        }

        if (YellowConnectionId == connectionId)
        {
            return "Y";
        }

        return null;
    }

    public string? GetPlayerColorByToken(string token)
    {
        if (RedToken == token)
        {
            return "R";
        }

        if (YellowToken == token)
        {
            return "Y";
        }

        return null;
    }

    public void RemoveConnection(string connectionId)
    {
        if (RedConnectionId == connectionId)
        {
            RedConnectionId = null;
        }
        else if (YellowConnectionId == connectionId)
        {
            YellowConnectionId = null;
        }
    }

    public bool TryDropDisc(string player, int column, out int row, out string? error)
    {
        row = -1;
        error = null;

        if (!HasTwoPlayers)
        {
            error = "Waiting for a second player.";
            return false;
        }

        if (GameOver)
        {
            error = "The game is over. Start a new round.";
            return false;
        }

        if (player != CurrentPlayer)
        {
            error = "It is not your turn.";
            return false;
        }

        if (column < 0 || column >= Columns)
        {
            error = "Invalid column.";
            return false;
        }

        row = GetAvailableRow(column);
        if (row < 0)
        {
            error = "That column is full.";
            return false;
        }

        Board[row][column] = player;

        WinningCells = GetWinningCells(row, column, player);
        if (WinningCells.Count > 0)
        {
            GameOver = true;
            Winner = player;
            return true;
        }

        if (IsBoardFull())
        {
            GameOver = true;
            Winner = null;
            return true;
        }

        CurrentPlayer = player == "R" ? "Y" : "R";
        return true;
    }

    public void ResetBoard()
    {
        Board = Enumerable.Range(0, Rows)
            .Select(_ => new string?[Columns])
            .ToArray();
        CurrentPlayer = "R";
        GameOver = false;
        Winner = null;
        WinningCells = [];
    }

    private int GetAvailableRow(int column)
    {
        for (var row = Rows - 1; row >= 0; row--)
        {
            if (Board[row][column] is null)
            {
                return row;
            }
        }

        return -1;
    }

    private bool IsBoardFull()
    {
        return Board[0].All(cell => cell is not null);
    }

    private List<int[]> GetWinningCells(int row, int column, string player)
    {
        var directions = new (int RowStep, int ColumnStep)[]
        {
            (0, 1),
            (1, 0),
            (1, 1),
            (1, -1)
        };

        foreach (var direction in directions)
        {
            var cells = new List<int[]> { new[] { row, column } };
            cells.AddRange(CollectDirection(row, column, direction.RowStep, direction.ColumnStep, player));
            cells.InsertRange(0, CollectDirection(row, column, -direction.RowStep, -direction.ColumnStep, player));

            if (cells.Count >= 4)
            {
                return cells.Take(4).ToList();
            }
        }

        return [];
    }

    private IEnumerable<int[]> CollectDirection(int startRow, int startColumn, int rowStep, int columnStep, string player)
    {
        var row = startRow + rowStep;
        var column = startColumn + columnStep;

        while (row >= 0
            && row < Rows
            && column >= 0
            && column < Columns
            && Board[row][column] == player)
        {
            yield return new[] { row, column };
            row += rowStep;
            column += columnStep;
        }
    }
}
