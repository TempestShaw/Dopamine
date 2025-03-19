interface TitleData {
    timestamp: number;
    process: string;
    title: string;
}

interface DayActivity {
    date: string;
    work: number;
    study: number;
    social: number;
    other: number;
    total: number;
}

class ActivityService {
    private static instance: ActivityService;
    private cache: Map<string, DayActivity> = new Map();
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
                    'Authorization': `BEARER ${pinCode}`
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
                'Authorization': `BEARER ${this.pinCode}`
            }
        });
        if (response.status === 403) throw new Error('Invalid pin code');
        return response.json();
    }

    private categorizeTitles(titles: TitleData[]): DayActivity {
        const categories = {
            work: 0,
            study: 0,
            social: 0,
            other: 0,
            total: 0
        };

        titles.forEach(title => {
            // Add your categorization logic here
            if (title.process.includes('Chrome')) categories.work++;
            else if (title.process.includes('Word')) categories.study++;
            else if (title.process.includes('Discord')) categories.social++;
            else categories.other++;
        });

        categories.total = categories.work + categories.study + categories.social + categories.other;

        return {
            date: new Date().toISOString().split('T')[0],
            ...categories
        };
    }

    async getDayActivity(date: Date): Promise<DayActivity> {
        const dateStr = date.toISOString().split('T')[0];
        
        // Check cache first
        if (this.cache.has(dateStr)) {
            return this.cache.get(dateStr)!;
        }

        // Fetch data for the whole day
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const titles = await this.fetchTitles(
            Math.floor(startOfDay.getTime() / 1000),
            Math.floor(endOfDay.getTime() / 1000)
        );

        const activity = this.categorizeTitles(titles);
        this.cache.set(dateStr, activity);
        
        return activity;
    }
}

export const activityService = ActivityService.getInstance();