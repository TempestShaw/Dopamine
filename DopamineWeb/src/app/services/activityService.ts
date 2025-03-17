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
    private baseUrl = 'http://localhost:6000';
    private pinCode: string | null = null;

    private constructor() {}

    static getInstance() {
        if (!this.instance) {
            this.instance = new ActivityService();
        }
        return this.instance;
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
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error verifying pin code:', error);
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