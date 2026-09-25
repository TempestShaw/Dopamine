using DopamineWin.Models;

namespace DopamineWin;

/// <summary>
/// `DopamineWin.exe --selftest`: checks the C# categorizer against cases shared with the web tests
/// (DopamineWeb/src/lib/nlp.test.ts, categories.test.ts). CI runs it; failures go to dopamine.log
/// and the exit code.
/// </summary>
public static class SelfTest
{
    public static int Run()
    {
        var failures = new List<string>();
        void Check(string what, object? got, object? want)
        {
            if (!Equals(got, want)) failures.Add($"{what}: got {got}, want {want}");
        }

        var seed = Categories.Model(new Dictionary<string, string>(), new Dictionary<string, string>(), []);
        Category Cat(string title, string process, TitleModel? model = null) => Categories.Categorize(title, process, null, model ?? seed);

        Check("tokenize", string.Join(",", TitleModel.Tokenize("Python 零基础入门")), "python,零基,基础,础入,入门");
        Check("tokenize stop words", string.Join(",", TitleModel.Tokenize("The 3 Best Tutorials")), "best,tutorials");
        Check("haystack", Categories.Haystack("LeagueClientUx").Contains("league client ux"), true);
        Check("haystack digits", Categories.Haystack("idea64").Contains("idea 64"), true);
        Check("clean title", Categories.CleanTitle("Inbox - Gmail - Google Chrome", "chrome"), "Inbox - Gmail");

        (string Title, Category Want)[] unseen =
        [
            ("Week 6 lecture: dynamic programming", Category.Study), ("机器学习课程 第五讲", Category.Study), ("統計學期末考複習", Category.Study),
            ("Q4 sales report", Category.Work), ("季度工作汇报", Category.Work), ("同学群聊", Category.Social),
            ("周末电影推荐", Category.Entertainment), ("明天天气预报", Category.Other),
        ];
        foreach (var (title, want) in unseen) Check($"model: {title}", seed.Classify(title)?.Category, want);

        (string Title, string Process, Category Want)[] cases =
        [
            ("Pull requests · TempestShaw/Dopamine · GitHub - Google Chrome", "chrome", Category.Work),
            ("Two Sum - LeetCode - Google Chrome", "chrome", Category.Study),
            ("YouTube - Google Chrome", "chrome", Category.Entertainment),
            ("Lecture 3: Sorting algorithms - YouTube - Google Chrome", "chrome", Category.Study),
            ("Python 零基础入门教程_哔哩哔哩_bilibili", "Arc", Category.Study),
            ("(12) lofi hip hop radio - beats to relax/study to - YouTube - Google Chrome", "chrome", Category.Entertainment),
            ("Free Barcode Generator - Google Chrome", "chrome", Category.Other),
            ("小红书 - 你的生活指南", "chrome", Category.Social),
            ("Lecture notes — Operating Systems", "Notion", Category.Study),
            ("Q3 roadmap", "Notion", Category.Work),
            ("Week 39", "Notion Calendar", Category.Work),
            ("", "idea64", Category.Work),
            ("VALORANT", "VALORANT-Win64-Shipping", Category.Entertainment),
            ("C:\\Users\\me\\Code", "explorer", Category.Other),
            ("Minecraft 1.20.1", "javaw", Category.Entertainment),
            ("Kestrel Bramble", "Arc", Category.Other),
        ];
        foreach (var (title, process, want) in cases) Check($"{process} | {title}", Cat(title, process), want);

        Check("hint: steamapps", Categories.Categorize("x", "HollowKnight", new StoredApp(null, null, null, null, @"D:\SteamLibrary\steamapps\common\Hollow Knight\hollow_knight.exe"), seed), Category.Entertainment);

        // Sorting one window by hand teaches similar ones.
        var taught = Categories.Model(new Dictionary<string, string> { ["Kestrel Bramble"] = "work" }, new Dictionary<string, string>(), []);
        Check("learned from a label", Cat("Bramble v2", "Arc", taught), Category.Work);
        Check("title rules: longest keyword", Categories.FromTitleRules("CS 101 grading sheet", new Dictionary<string, string> { ["cs 101"] = "study", ["CS 101 grading"] = "work" }), Category.Work);
        Check("format seconds", TodaySummary.Format(42, Lang.En), "42s");
        Check("format hours", TodaySummary.Format(192 * 60, Lang.ZhHans), "3小时12分");

        foreach (var f in failures) Log.Error("selftest: " + f);
        Log.Info(failures.Count == 0 ? "selftest: all passed" : $"selftest: {failures.Count} failed");
        return failures.Count == 0 ? 0 : 1;
    }
}
