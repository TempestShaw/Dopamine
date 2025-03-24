import moment from "moment";
import { GroupedData, ProcessGroup, ProcessSummary, TimeSession, TitleData } from "../types";


class ActivityService {
    private static instance: ActivityService;
    private cache: Map<string, TimeSession[]> = new Map();
    private baseUrl: string;
    private pinCode: string | null = null;

    private constructor() {
        this.baseUrl = 'http://localhost:26535';
        if (typeof window !== 'undefined') {
            this.baseUrl = localStorage.getItem('dopamineUrl') || this.baseUrl;
            this.pinCode = localStorage.getItem('dopaminePinCode');
        }
    }

    async verifyPinCode(pinCode: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/pair`, {
                headers: {
                    'Authorization': `Bearer ${pinCode}`
                }
            });

            if (response.status === 200) {
                this.pinCode = pinCode;
                if (typeof window !== 'undefined') {
                    localStorage.setItem('dopaminePinCode', pinCode);
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error verifying pin code:', error);
            return false;
        }
    }

    isAuthenticated(): boolean {
        return !!this.pinCode;
    }
    setBaseUrl(url: string) {
        this.baseUrl = url;
        if (typeof window !== 'undefined') {
            localStorage.setItem('dopamineUrl', url);
        }
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new ActivityService();
        }
        return this.instance;
    }

    async healthCheck(url?: string): Promise<boolean> {
        const checkUrl = url || this.baseUrl;
        try {
            const response = await fetch(`${checkUrl}/identify`);
            const data = await response.json();
            if (data.name === "dopamine-win") {
                if (url) this.setBaseUrl(url);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error checking health:', error);
            return false;
        }
    }
    private formatWindowTitle(title: string): string {
        if (title.includes('\\') || title.includes('/')) {
            const parts = title.split(/[\/\\]/);
            return parts[parts.length - 1];
        }
        return title;
    }

    private async fetchTitles(from: number, to: number): Promise<TitleData[]> {
        if (!this.pinCode) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`${this.baseUrl}/titles?from=${from}&to=${to}`, {
            headers: {
                'Authorization': `Bearer ${this.pinCode}`
            }
        });
        if (response.status === 403) throw new Error('Invalid pin code');
        return response.json();
        return ([
            {
                "id": 1,
                "timestamp": 1742655200, // 开始时间
                "windowTitle": "Visual Studio Code - DopamineWeb",
                "processName": "Code"
            },
            {
                "id": 1,
                "timestamp": 1742660200, // 开始时间
                "windowTitle": "Visual Studio Code - DopamineWeb",
                "processName": "Code"
            },
            {
                "id": 2,
                "timestamp": 1742665200,
                "windowTitle": "React Documentation",
                "processName": "Chrome"
            },
            {
                "id": 3,
                "timestamp": 1742670200,
                "windowTitle": "TypeScript Handbook",
                "processName": "Chrome"
            },
            {
                "id": 4,
                "timestamp": 1742675200,
                "windowTitle": "<Stopped>",
                "processName": "<Dopamine>"
            },
            // 3月22日数据
            {
                "id": 5,
                "timestamp": 1742680200,
                "windowTitle": "GitHub - Dopamine Project",
                "processName": "Chrome"
            },
            {
                "id": 6,
                "timestamp": 1742685200,
                "windowTitle": "Discord - Programming Help",
                "processName": "Discord"
            },
            {
                "id": 7,
                "timestamp": 1742690200,
                "windowTitle": "Stack Overflow - React Hooks",
                "processName": "Chrome"
            },
            {
                "id": 8,
                "timestamp": 1742695200,
                "windowTitle": "<Stopped>",
                "processName": "<Dopamine>"
            },
            // 3月23日数据
            {
                "id": 9,
                "timestamp": 1742700200,
                "windowTitle": "D:\\Projects\\Dopamine\\DopamineWin\\bin\\Release\\net8.0-windows - File Explorer",
                "processName": "explorer"
            },
            {
                "id": 10,
                "timestamp": 1742705200,
                "windowTitle": "Identify - My Workspace",
                "processName": "Postman"
            },
            {
                "id": 11,
                "timestamp": 1742710200,
                "windowTitle": "D:\\Projects\\Dopamine\\DopamineWin\\bin\\Release\\net8.0-windows - Folder Explorer",
                "processName": "explorer"
            },
            {
                "id": 12,
                "timestamp": 1742717900,
                "windowTitle": "GRE-333",
                "processName": "Discord"
            },
            {
                "id": 13,
                "timestamp": 1742725100,
                "windowTitle": "D:\\Projects\\Dopamine\\DopamineWin\\bin\\Release\\net8.0-windows - File Explorer",
                "processName": "explorer"
            },
            {
                "id": 14,
                "timestamp": 1742732300,
                "windowTitle": "<Stopped>",
                "processName": "<Dopamine>"
            },
            {
                "id": 15,
                "timestamp": 1742740000,
                "windowTitle": "D:\\Projects\\Dopamine\\DopamineWin\\bin\\Release\\net8.0-win - File Explorer",
                "processName": "explorer"
            },
            {
                "id": 16,
                "timestamp": 1742747200,
                "windowTitle": "<Stopped>",
                "processName": "<Dopamine>"
            },
        ])
    }

    private categorizeTitles(windowTitle: string, processName: string): string {
        // Work related
        const workRegex = /(Chrome|Edge|Firefox|Safari|Postman|VSCode|Visual Studio|IntelliJ|WebStorm|PyCharm|PhpStorm|Sublime|Atom|Terminal|iTerm|PowerShell|cmd|Git|GitHub|GitLab|Jira|Confluence|Slack|Teams|Zoom|Meet|Excel|PowerPoint|Outlook|Word|Access|SharePoint|OneDrive|Dropbox|FileZilla|putty|WinSCP|Docker|VMware|VirtualBox)/i;

        // Study related
        const studyRegex = /(Coursera|Udemy|edX|Kindle|PDF|Notion|Evernote|OneNote|Anki|Quizlet|Canvas|Blackboard|Moodle|Academia|ResearchGate|Google Scholar|Wikipedia|Dictionary|Translator|Calculator|WolframAlpha|LaTeX|Overleaf|Mendeley|Zotero)/i;

        // Social and entertainment
        const socialRegex = /(Discord|WhatsApp|Telegram|Signal|WeChat|LINE|Facebook|Messenger|Instagram|Twitter|LinkedIn|Reddit|TikTok|YouTube|Twitch|Netflix|Prime|Hulu|Disney|Spotify|Apple Music|Steam|Epic|Battle.net|Origin|Minecraft|Roblox)/i;

        // Development tools
        const devRegex = /(npm|yarn|webpack|babel|react|vue|angular|node|python|java|cpp|golang|rust|ruby|php|mysql|mongodb|postgres|redis|apache|nginx|kubernetes|jenkins|travis|circleci)/i;

        // Check both window title and process name
        const titleAndProcess = `${windowTitle} ${processName}`.toLowerCase();

        if (workRegex.test(titleAndProcess) || devRegex.test(titleAndProcess)) return 'work';
        if (studyRegex.test(titleAndProcess)) return 'study';
        if (socialRegex.test(titleAndProcess)) return 'social';
        return 'other';
    }
    private parsingStreamData(titles: TitleData[]): TimeSession[] {
        const timeSessions: TimeSession[] = [];
        timeSessions.push(
            {
                "time": moment(new Date(titles[0].timestamp * 1000)).format("YYYY-MM-DDTHH:mm"),
                "activities": []
            }
        );
        for (let i = 1; i < titles.length; i++) {
            const title = titles[i];
            const date = new Date(title.timestamp * 1000);
            const prevTitle = titles[i - 1]
            const prevDate = new Date(prevTitle.timestamp * 1000);
            const timeDiff = date.getTime() - prevDate.getTime();
            const currentSession = timeSessions[timeSessions.length - 1];

            if (currentSession.activities.length === 0) {
                const titleCategory = this.categorizeTitles(prevTitle.windowTitle, prevTitle.processName);
                currentSession.activities.push({
                    processName: prevTitle.processName,
                    behavior: [{
                        title: this.formatWindowTitle(prevTitle.windowTitle),
                        duration: timeDiff,
                        category: titleCategory
                    }]
                });
                continue;
            }
            if (timeDiff < 2 * 60 * 1000) {
                const currentSession = timeSessions[timeSessions.length - 1];
                const titleCategory = this.categorizeTitles(prevTitle.windowTitle, prevTitle.processName);
                const existingActivity = currentSession.activities.find(
                    activity => activity.processName === prevTitle.processName
                );

                if (existingActivity) {
                    existingActivity.behavior.push({
                        title: this.formatWindowTitle(prevTitle.windowTitle),
                        duration: timeDiff,
                        category: titleCategory
                    });
                } else {
                    currentSession.activities.push({
                        processName: prevTitle.processName,
                        behavior: [{
                            title: this.formatWindowTitle(prevTitle.windowTitle),
                            duration: timeDiff,
                            category: titleCategory
                        }]
                    });
                }

            } else {
                const titleCategory = this.categorizeTitles(prevTitle.windowTitle, prevTitle.processName);
                const activity = {
                    title: this.formatWindowTitle(prevTitle.windowTitle),
                    duration: prevTitle.processName === "<Dopamine>" ? 0 : timeDiff,
                    category: titleCategory
                };

                const processGroup = currentSession.activities.find(a => a.processName === prevTitle.processName) || (() => {
                    const newGroup = {
                        processName: prevTitle.processName,
                        behavior: []
                    };
                    currentSession.activities.push(newGroup);
                    return newGroup;
                })();
                processGroup.behavior.push(activity);
                if (i !== titles.length - 1) {
                    const time = moment(date).format("YYYY-MM-DDTHH:mm");
                    timeSessions.push({ "time": time, "activities": [] });
                }
            }
        }
        return timeSessions;
    }

    async getDayActivity(date: Date): Promise<TimeSession[]> {
        const dateStr = moment(date).format('YYYY-MM-DD');

        if (this.cache.has(dateStr)) {
            return this.cache.get(dateStr)!;
        }

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const titles = await this.fetchTitles(
            Math.floor(startOfDay.getTime() / 1000),
            Math.floor(endOfDay.getTime() / 1000)
        );
        if (titles.length == 0) return []
        const activity = this.parsingStreamData(titles);
        this.cache.set(dateStr, activity);

        return activity;
    }

    async getActivities(timeRange: 'day' | 'week' | 'month', date: Date): Promise<TimeSession[][]> {
        const startTime = moment(date).startOf('month').toDate();
        const endTime = moment(date).endOf('month').toDate();

        const titles = await this.fetchTitles(
            Math.floor(startTime.getTime() / 1000),
            Math.floor(endTime.getTime() / 1000)
        );

        const groupedTitles: { [key: string]: TitleData[] } = {};
        if (titles.length == 0) return []
        titles.forEach(title => {
            const day = moment(title.timestamp * 1000).format('YYYY-MM-DD');
            if (!groupedTitles[day]) {
                groupedTitles[day] = [];
            }
            groupedTitles[day].push(title);
        });

        const activities: TimeSession[][] = [];
        const days = Object.keys(groupedTitles).sort();

        days.forEach(day => {
            const dayActivities = this.parsingStreamData(groupedTitles[day]);
            this.cache.set(day, dayActivities);
            activities.push(dayActivities);
        });
        return activities;
    }

    private processStreamData(streamData: TimeSession[][]): GroupedData {
        const groupedData: GroupedData = {};
        streamData.forEach((daily) => {

            if (!daily || daily.length === 0) return;
            daily.forEach((session) => {
                if (!groupedData[session.time.split('T')[0]]) {
                    groupedData[session.time.split('T')[0]] = {};
                }

                if (!session.time) return;
                const time = session.time.split('T')[1];
                groupedData[session.time.split('T')[0]][time] = [];
                session.activities.forEach((process) => {
                    if (!groupedData[session.time.split('T')[0]][time].find((group) => group.processName === process.processName)) {
                        const mergedBehaviors: {
                            title: string;
                            duration: number;
                            category: string;
                        }[] = [];
                        const behaviorMap = new Map<string, {
                            title: string;
                            duration: number;
                            category: string;
                        }>();
                        const summary: Record<string, number> = {
                            work: 0,
                            study: 0,
                            social: 0,
                            other: 0,
                        };

                        process.behavior.forEach(behavior => {
                            const existingBehavior = behaviorMap.get(behavior.title);
                            if (existingBehavior) {
                                existingBehavior.duration += behavior.duration;
                            } else {
                                behaviorMap.set(behavior.title, { ...behavior });
                                mergedBehaviors.push(behaviorMap.get(behavior.title)!);
                            }

                            summary[behavior.category] = summary[behavior.category] || 0;
                        });

                        groupedData[session.time.split('T')[0]][time].push({
                            processName: process.processName,
                            behaviors: mergedBehaviors,
                            summary: summary
                        });
                    }

                    const currentGroup = groupedData[session.time.split('T')[0]][time].find(
                        (group) => group.processName === process.processName
                    )!;

                    currentGroup.summary = {
                        work: 0,
                        study: 0,
                        social: 0,
                        other: 0,
                    };

                    currentGroup.behaviors.forEach((behavior) => {
                        currentGroup.summary[behavior.category] += behavior.duration;
                    });
                });
            });
        });
        return groupedData;
    }

    async getProcessedActivity(timeRange: 'day' | 'week' | 'month', date: Date): Promise<GroupedData> {
        const activities = await this.getActivities(timeRange, date);
        return this.processStreamData(activities);
    }

    private getTimeUnitConfig(timeRange: 'day' | 'week' | 'month', date: Date) {
        switch (timeRange) {
            case 'day':
                return {
                    groupKey: moment(date).format('YYYY-MM-DD'), // Use date as key
                    format: (date: moment.Moment) => date.format('HH'),
                };
            case 'week':
                return {
                    groupKey: moment(date).startOf('week').format('YYYY-[W]WW'), // Use week number as key
                    format: (date: moment.Moment) => date.format('YYYY-MM-DD'),
                };
            case 'month':
                return {
                    groupKey: moment(date).startOf('month').format('YYYY-MM'), // Use month as key
                    format: (date: moment.Moment) => `${date.format('YYYY')}-W${date.week()}`,
                };
        }
    }

    async getGroupedActivity(processedData: GroupedData, timeRange: 'day' | 'week' | 'month', date: Date): Promise<{ [date: string]: { [timeUnit: string]: ProcessGroup[] } }> {
        const { groupKey, format } = this.getTimeUnitConfig(timeRange, date);
        const groupedData: { [date: string]: { [timeUnit: string]: ProcessGroup[] } } = {
            [groupKey]: {}
        };

        // for day view only get specific date
        const filteredData = timeRange === 'day' 
            ? Object.entries(processedData).filter(([dateStr]) => dateStr === groupKey)
            : Object.entries(processedData);

        filteredData.forEach(([dateStr, dailyData]) => {
            Object.entries(dailyData).forEach(([timeStr, sessionGroup]) => {
                const timeUnit = format(moment(dateStr + 'T' + timeStr));
                if (!groupedData[groupKey][timeUnit]) {
                    groupedData[groupKey][timeUnit] = [];
                }

                sessionGroup.forEach(process => {
                    const existingProcess = groupedData[groupKey][timeUnit].find(
                        p => p.processName === process.processName
                    );

                    if (existingProcess) {
                        process.behaviors.forEach(behavior => {
                            const existingBehavior = existingProcess.behaviors.find(
                                b => b.title === behavior.title
                            );
                            if (existingBehavior) {
                                existingBehavior.duration += behavior.duration;
                            } else {
                                existingProcess.behaviors.push({ ...behavior });
                            }
                        });

                        Object.entries(process.summary).forEach(([category, duration]) => {
                            existingProcess.summary[category] =
                                (existingProcess.summary[category] || 0) + duration;
                        });
                    } else {
                        groupedData[groupKey][timeUnit].push({
                            processName: process.processName,
                            behaviors: [...process.behaviors],
                            summary: { ...process.summary }
                        });
                    }
                });
            });
        });

        return groupedData;

    }

    getCategorySummary(data: GroupedData | { [hour: string]: ProcessGroup[] } | ProcessGroup[]): ProcessSummary {
        const summary: ProcessSummary = {};

        const processValue = (value: GroupedData | { [hour: string]: ProcessGroup[] } | ProcessGroup[]) => {
            if (Array.isArray(value)) {
                value.forEach(group => {
                    if ('summary' in group) {
                        Object.entries(group.summary).forEach(([category, duration]) => {
                            summary[category] = (summary[category] || 0) + duration;
                        });
                    }
                });
            } else if (typeof value === 'object' && value !== null) {
                Object.values(value).forEach(v => processValue(v));
            }
        };

        processValue(data);

        summary.total = Object.entries(summary)
            .filter(([key]) => key !== 'total')
            .reduce((acc, [, duration]) => acc + duration, 0);

        return summary;
    }
    async getActivitySummary(groupData: GroupedData): Promise<{ [dateUnit: string]: ProcessSummary }> {
        const summary: { [dateUnit: string]: ProcessSummary } = {};
        Object.entries(groupData).forEach(([date, unitData]) => {
            Object.values(unitData).forEach(sessionGroup => {
                summary[date] = this.getCategorySummary(sessionGroup);
            });
        });
        return summary;
    }
}

export const activityService = ActivityService.getInstance();

