'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { activityService } from '@/app/services/activityService';
import { TimeSession, GroupedData, ProcessGroup } from '../types';

interface ExtendedActivityContextType {
    rawActivities: TimeSession[][];
    processedActivities: GroupedData;
    groupedActivities: {[date: string]: { [time: string]: ProcessGroup[] }};
    loading: boolean;
    timeRange: 'day' | 'week' | 'month';
    selectedDate: Date;
    changeTimeRange: (newRange: 'day' | 'week' | 'month') => void;
    changeDate: (newDate: Date) => void;
}

const ActivityContext = createContext<ExtendedActivityContextType>({
    rawActivities: [],
    processedActivities: {},
    groupedActivities: {},
    loading: true,
    timeRange: 'day',
    selectedDate: new Date(),
    changeTimeRange: () => {},
    changeDate: () => {}
});

export function ActivityProvider({ children }: { children: ReactNode }) {
    const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('day');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [rawActivities, setRawActivities] = useState<TimeSession[][]>([]);
    const [processedActivities, setProcessedActivities] = useState<GroupedData>({});
    const [groupedActivities, setGroupedActivities] = useState<{ [date: string]: { [hour: string]: ProcessGroup[] }}>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const activities = await activityService.getActivities(timeRange, selectedDate);
                setRawActivities(activities);

                const processed = await activityService.getProcessedDayActivity(selectedDate);
                setProcessedActivities(processed);

                const grouped = await activityService.getGroupedActivity(timeRange, selectedDate);
                setGroupedActivities(grouped);

                setLoading(false);
            } catch (error) {
                console.error('Error fetching activity data:', error);
                setLoading(false);
            }
        };

        fetchData();
    }, [timeRange, selectedDate]);

    const changeTimeRange = (newRange: 'day' | 'week' | 'month') => {
        setTimeRange(newRange);
    };

    const changeDate = (newDate: Date) => {
        setSelectedDate(newDate);
    };

    return (
        <ActivityContext.Provider value={{
            rawActivities,
            processedActivities,
            groupedActivities,
            loading,
            timeRange,
            selectedDate,
            changeTimeRange,
            changeDate
        }}>
            {children}
        </ActivityContext.Provider>
    );
}

export const useActivity = () => useContext(ActivityContext);