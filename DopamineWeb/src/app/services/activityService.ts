import moment, { duration } from "moment";
import { DayActivity, TimeSession, TitleData } from "../types";


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
                "timestamp": 1742300803,
                "windowTitle": "D:\\Projects\\Dopamine\\DopamineWin\\bin\\Release\\net8.0-windows - File Explorer",
                "processName": "explorer"
            },
            {
                "id": 2,
                "timestamp": 1742300808,
                "windowTitle": "Identify - My Workspace",
                "processName": "Postman"
            },
            {
                "id": 3,
                "timestamp": 1742300817,
                "windowTitle": "@GRE 333 - Discord",
                "processName": "Discord"
            },
            {
                "id": 4,
                "timestamp": 1742300821,
                "windowTitle": "<Stopped>",
                "processName": "<Dopamine>"
            },
            {
                "id": 5,
                "timestamp": 1742301618,
                "windowTitle": "D:\\Projects\\Dopamine\\DopamineWin\\bin\\Release\\net8.0-windows - File Explorer",
                "processName": "explorer"
            },
            {
                "id": 6,
                "timestamp": 1742301620,
                "windowTitle": "D:\\Projects\\Dopamine\\DopamineWin\\bin\\Release\\net8.0-windows - File Explorer",
                "processName": "explorer"
            },
        ])
    }

    private summarizeTitles(titles: TitleData[]): DayActivity {
        const categories = {
            work: 0,
            study: 0,
            social: 0,
            other: 0,
            total: 0
        };

        titles.forEach(title => {
            // Add your categorization logic here
            if (title.processName.includes('Chrome')) categories.work++;
            else if (title.processName.includes('Word')) categories.study++;
            else if (title.processName.includes('Discord')) categories.social++;
            else categories.other++;
        });

        categories.total = categories.work + categories.study + categories.social + categories.other;

        return {
            date: new Date().toISOString().split('T')[0],
            ...categories
        };
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
        let prevTitle = titles[0];
        const firstTime = moment(new Date(prevTitle.timestamp * 1000)).format("YYYY-MM-DDTHH:mm");
        const timeSessions: TimeSession[] = [{ time: firstTime, activities: [] }];
       
        for (let i = 1; i < titles.length; i++) {
            const title = titles[i];
            const date = new Date(title.timestamp * 1000);
            const prevDate = new Date(titles[i - 1].timestamp * 1000);
            const timeDiff = date.getTime() - prevDate.getTime();
            
            if(timeSessions[timeSessions.length - 1].activities.length === 0){
                
                let titleCategory = this.categorizeTitles(prevTitle.windowTitle, prevTitle.processName);
                timeSessions[timeSessions.length - 1].activities.push({
                    processName: prevTitle.processName,
                    behavior: [{
                        title: prevTitle.windowTitle,
                        duration: timeDiff,
                        category: titleCategory
                    }]
                });
                continue;
            }
            if (timeDiff < 2 * 60 * 1000) {
                const currentSession = timeSessions[timeSessions.length - 1];
                let titleCategory = this.categorizeTitles(title.windowTitle, title.processName);
                const existingActivity = currentSession.activities.find(
                    activity => activity.processName === title.processName
                );

                if (existingActivity) {
                    existingActivity.behavior.push({
                        title: title.windowTitle,
                        duration: timeDiff,
                        category: titleCategory
                    });
                } else {
                    currentSession.activities.push({
                        processName: title.processName,
                        behavior: [{
                            title: title.windowTitle,
                            duration: timeDiff,
                            category: titleCategory
                        }]
                    });
                }
            } else {
                const time = moment(date).format("HH:mm");
                timeSessions.push({"time": time, "activities": []});
                prevTitle = title;
            }
            }
    console.log(timeSessions);
    return timeSessions;
        }

    
    async getDayActivity(date: Date): Promise<TimeSession[]> {
        const dateStr = date.toISOString().split('T')[0];
        
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

        // const activity = this.categorizeTitles(titles);
        const activity = this.parsingStreamData(titles);
        
        this.cache.set(dateStr, activity);
        
        return activity;
    }
    async getWeekActivity(date: Date): Promise<TimeSession[][]> {
        const weekActivities: TimeSession[][] = [];
        const startOfWeek = moment(date).startOf('week');

        for (let i = 0; i < 7; i++) {
            const day = new Date(startOfWeek.toDate());
            day.setDate(day.getDate() + i);
            weekActivities.push(await this.getDayActivity(day));
        }

        return weekActivities;
    }
    async getMonthActivity(date: Date): Promise<TimeSession[][]> {
        const month = date.getMonth();
        const year = date.getFullYear();
        const daysInMonth = moment(date).daysInMonth();
        const monthActivities: TimeSession[][] = [];

        for (let i = 1; i <= daysInMonth; i++) {
            const day = new Date(year, month, i);
            monthActivities.push(await this.getDayActivity(day));
        }

        return monthActivities;
    }
}

export const activityService = ActivityService.getInstance();
