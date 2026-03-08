using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace ConnectFourGame.Pages;

public class IndexModel : PageModel
{
    [BindProperty(SupportsGet = true)]
    public string? Difficulty { get; set; }

    public string PortfolioUrl { get; private set; } = "/";

    public string SelectedDifficulty =>
        Difficulty?.ToLowerInvariant() is "easy" or "hard"
            ? Difficulty.ToLowerInvariant()
            : "normal";

    public void OnGet()
    {
        var configuredUrl = Environment.GetEnvironmentVariable("PORTFOLIO_URL");
        if (!string.IsNullOrWhiteSpace(configuredUrl))
        {
            PortfolioUrl = configuredUrl;
        }
    }
}
