export interface TitleData {
    id: number;
    timestamp: number;
    processName: string;
    windowTitle: string;
}

export interface DayActivity {
    date: string;
    work: number;
    study: number;
    social: number;
    other: number;
    total: number;
}

export interface Activity {
processName: string;
behavior: {
    title: string;
    duration: number;
    category: string;
}[];
}

export interface TimeSession {
time: string;
activities: Activity[];
}

export interface ActivityContextType {
    activities: TimeSession[][];
    loading: boolean;
}

export interface StreamSectionProps {
    streamData: TimeSession[][];
}

interface ProcessBehavior {
    title: string;
    duration: number;
    category: string;
}

export interface ProcessSummary {
    [category: string]: number;
}

export interface ProcessGroup {
    processName: string;
    behaviors: ProcessBehavior[];
    summary: ProcessSummary;
}

interface DailyData {
    [time: string]: ProcessGroup[];
}

export interface GroupedData {
    [date: string]: DailyData;
}
