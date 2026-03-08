using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace ConnectFourGame.Pages;

public class IndexModel : PageModel
{
    private readonly IConfiguration configuration;

    public IndexModel(IConfiguration configuration)
    {
        this.configuration = configuration;
    }

    [BindProperty(SupportsGet = true)]
    public string? Difficulty { get; set; }

    public string PortfolioUrl { get; private set; } = "/";

    public string SelectedDifficulty =>
        Difficulty?.ToLowerInvariant() is "easy" or "hard"
            ? Difficulty.ToLowerInvariant()
            : "normal";

    public void OnGet()
    {
        var configuredUrl = configuration["PortfolioUrl"]
            ?? Environment.GetEnvironmentVariable("PORTFOLIO_URL");

        if (!string.IsNullOrWhiteSpace(configuredUrl))
        {
            PortfolioUrl = configuredUrl;
        }
    }
}
