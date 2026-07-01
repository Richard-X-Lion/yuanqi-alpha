import { SearchClient, Config as SearchConfig, HeaderUtils } from "coze-coding-dev-sdk";
import { UserDataConfig } from "@/lib/agents/config";
import { NewsItem } from "./types";
import { buildDataHeaders, resolveDataUrl, getStockNameByCode, fetchDataSource } from "./stock";

export async function fetchStockNews(stockCode: string, stockName?: string, userDataConfig?: UserDataConfig): Promise<NewsItem[]> {
  const searchName = stockName || getStockNameByCode(stockCode);
  console.log(`[News] Searching for: ${searchName} (code: ${stockCode})`);
  const results: NewsItem[] = [];
  const seenTitles = new Set<string>();

  function addNews(item: NewsItem) {
    const key = item.title.replace(/\s/g, "").slice(0, 20);
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      results.push(item);
    }
  }

  // Method A: getNewsByStock (东方财富个股新闻)
  try {
    const defaultUrl = `https://np-listapi.eastmoney.com/comm/web/getNewsByStock?code=${stockCode}&type=1&pageSize=30&client=web`;
    const url = resolveDataUrl(defaultUrl, userDataConfig);
    console.log(`[News] Method A trying: ${url}`);
    const resp = await fetchDataSource(url, {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      headers: buildDataHeaders(userDataConfig, { Referer: "https://so.eastmoney.com/" }),
    }, userDataConfig, "自定义新闻数据源");
    console.log(`[News] Method A status: ${resp.status}`);
    if (resp.ok) {
      const data = await resp.json();
      const list = data?.data?.list;
      if (Array.isArray(list) && list.length > 0) {
        console.log(`[News] Method A got ${list.length} articles`);
        for (const item of list.slice(0, 30)) {
          addNews({
            title: item.title || "",
            date: item.showTime || item.pubTime || "",
            summary: item.digest || item.content || "",
            source: item.source || "东方财富",
          });
        }
      }
    }
  } catch { /* continue */ }

  // Method B: 东方财富搜索API (jsonp) - 扩大到30条
  try {
    const param = JSON.stringify({
      uid: "", keyword: searchName, type: ["cmsArticleWebOld"],
      client: "web", clientType: "web", clientVersion: "curr",
      param: { cmsArticleWebOld: { searchScope: "default", sortFilter: "default", pageIndex: 1, pageSize: 30 } },
    });
    const defaultUrl = `https://search-api-web.eastmoney.com/search/jsonp?cb=jQuery&param=${encodeURIComponent(param)}`;
    const url = resolveDataUrl(defaultUrl, userDataConfig);
    const resp = await fetchDataSource(url, {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      headers: buildDataHeaders(userDataConfig, { Referer: "https://so.eastmoney.com/" }),
    }, userDataConfig, "自定义新闻数据源");
    console.log(`[News] Method B status: ${resp.status}`);
    if (resp.ok) {
      const text = await resp.text();
      const jsonStr = text.replace(/^jQuery\(/, "").replace(/\)$/, "");
      const data = JSON.parse(jsonStr);
      const rawArticles = data?.result?.cmsArticleWebOld;
      const articles = Array.isArray(rawArticles) ? rawArticles : (rawArticles?.list || []);
      if (articles.length > 0) {
        console.log(`[News] Method B got ${articles.length} articles`);
        for (const item of articles.slice(0, 30)) {
          const cleanTitle = String(item.title || "").replace(/<[^>]+>/g, "");
          const cleanContent = String(item.content || item.description || "").replace(/<[^>]+>/g, "").slice(0, 300);
          addNews({
            title: cleanTitle,
            date: String(item.date || ""),
            summary: cleanContent,
            source: String(item.source || item.mediaName || "东方财富搜索"),
          });
        }
      }
    }
  } catch { /* continue */ }

  // Method C: 新浪财经新闻 - 扩大到30条
  try {
    const url = `https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&num=30&versionNumber=1.2.4&page=1&keyword=${encodeURIComponent(searchName)}`;
    console.log(`[News] Method C (Sina) trying, keyword: ${searchName}`);
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    console.log(`[News] Method C status: ${resp.status}`);
    if (resp.ok) {
      const data = await resp.json();
      const list = data?.result?.data;
      if (Array.isArray(list) && list.length > 0) {
        console.log(`[News] Method C got ${list.length} articles`);
        for (const item of list.slice(0, 30)) {
          addNews({
            title: item.title || "",
            date: item.ctime ? new Date(item.ctime * 1000).toISOString().split("T")[0] : "",
            summary: item.intro || item.abstract || "",
            source: item.author || item.media_name || "新浪财经",
          });
        }
      }
    }
  } catch (e) { console.log(`[News] Method C failed: ${e instanceof Error ? e.message : String(e)}`); }

  // Method D: 东方财富研报
  try {
    const defaultUrl = `https://np-listapi.eastmoney.com/comm/web/getNewsByStock?code=${stockCode}&type=2&pageSize=10&client=web`;
    const url = resolveDataUrl(defaultUrl, userDataConfig);
    const resp = await fetchDataSource(url, {
      signal: AbortSignal.timeout(6000),
      redirect: "error",
      headers: buildDataHeaders(userDataConfig, { Referer: "https://so.eastmoney.com/" }),
    }, userDataConfig, "自定义研报数据源");
    console.log(`[News] Method D (研报) status: ${resp.status}`);
    if (resp.ok) {
      const data = await resp.json();
      const list = data?.data?.list;
      if (Array.isArray(list) && list.length > 0) {
        console.log(`[News] Method D got ${list.length} research reports`);
        for (const item of list.slice(0, 10)) {
          addNews({
            title: item.title || "",
            date: item.showTime || item.pubTime || "",
            summary: item.digest || item.content || "",
            source: item.source || "东方财富研报",
          });
        }
      }
    }
  } catch { /* continue */ }

  // Method E: 腾讯财经新闻
  try {
    const url = `https://guojiayu.com/api/news?keyword=${encodeURIComponent(searchName)}&count=20`;
    console.log(`[News] Method E (腾讯) trying`);
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      redirect: "error",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (resp.ok) {
      const data = await resp.json();
      const list = data?.data?.list || data?.data || [];
      if (Array.isArray(list) && list.length > 0) {
        console.log(`[News] Method E got ${list.length} articles`);
        for (const item of list.slice(0, 20)) {
          addNews({
            title: item.title || "",
            date: item.pubtime || item.time || "",
            summary: item.summary || item.desc || "",
            source: item.source || "腾讯财经",
          });
        }
      }
    }
  } catch { /* continue */ }

  // Filter out irrelevant news
  if (results.length > 0 && searchName) {
    const nameClean = searchName.replace(/[（）()]/g, "");
    const filtered = results.filter((item) => {
      const combined = (item.title + " " + (item.summary || "")).toLowerCase();
      if (combined.includes(nameClean.toLowerCase())) return true;
      if (combined.includes(stockCode)) return true;
      // Check for 2-char substrings of the stock name
      for (let i = 0; i < nameClean.length - 1; i++) {
        if (combined.includes(nameClean.slice(i, i + 2).toLowerCase())) return true;
      }
      return false;
    });
    if (filtered.length > 0) {
      console.log(`[News] Filtered: ${results.length} -> ${filtered.length} (relevant to "${searchName}")`);
      return filtered;
    }
    console.log(`[News] No relevant news found for "${searchName}", returning all`);
  }

  console.log(`[News] Total results: ${results.length}`);
  return results;
}

// Web search for broader sentiment/news coverage (using coze-coding-dev-sdk)
export async function webSearchNews(stockName: string, stockCode: string, requestHeaders?: Headers): Promise<NewsItem[]> {
  const results: NewsItem[] = [];
  const seenTitles = new Set<string>();
  function addNews(item: NewsItem) {
    const key = item.title.replace(/\s/g, "").slice(0, 20);
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      results.push(item);
    }
  }

  try {
    const customHeaders = requestHeaders ? HeaderUtils.extractForwardHeaders(requestHeaders) : undefined;
    const config = new SearchConfig();
    const client = new SearchClient(config, customHeaders);

    // Search 1: Recent stock news and sentiment
    const queries = [
      `${stockName} 最新消息 股票`,
      `${stockName} 行情分析 市场`,
    ];

    for (const query of queries) {
      try {
        console.log(`[WebSearch] Searching: "${query}"`);
        const response = await client.advancedSearch(query, {
          searchType: "web",
          count: 15,
          needSummary: false,
          timeRange: "1m",
        });
        if (response.web_items) {
          console.log(`[WebSearch] Got ${response.web_items.length} results for "${query}"`);
          for (const item of response.web_items) {
            addNews({
              title: item.title || "",
              date: item.publish_time || "",
              summary: item.snippet || item.summary || "",
              source: item.site_name || "网络搜索",
            });
          }
        }
      } catch (e) {
        console.log(`[WebSearch] Query "${query}" failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Search 3: AI summary for context
    try {
      const summaryResponse = await client.webSearchWithSummary(`${stockName} 投资前景 市场观点`, 10);
      if (summaryResponse.summary) {
        addNews({
          title: `${stockName} AI综合市场观点`,
          date: new Date().toISOString().split("T")[0],
          summary: summaryResponse.summary,
          source: "AI综合分析",
        });
      }
    } catch { /* continue */ }

  } catch (e) {
    console.log(`[WebSearch] Init failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  console.log(`[WebSearch] Total results: ${results.length}`);
  return results;
}
