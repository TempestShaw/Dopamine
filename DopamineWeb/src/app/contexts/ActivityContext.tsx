'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { activityService } from '@/app/services/activityService';
import { GroupedData, ProcessGroup } from '../types';

interface ExtendedActivityContextType {
    processedActivities: GroupedData;
    groupedActivities: { [date: string]: { [time: string]: ProcessGroup[] } };
    loading: boolean;
    view: 'day' | 'week' | 'month';
    selectedDate: Date;
    changeView: (newRange: 'day' | 'week' | 'month') => void;
    changeDate: (newDate: Date) => void;
}

const ActivityContext = createContext<ExtendedActivityContextType>({
    processedActivities: {},
    groupedActivities: {},
    loading: true,
    view: 'day',
    selectedDate: new Date(),
    changeView: () => { },
    changeDate: () => { }
});

export function ActivityProvider({ children }: { children: ReactNode }) {
    const [view, setView] = useState<'day' | 'week' | 'month'>('day');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [processedActivities, setProcessedActivities] = useState<GroupedData>({});
    const [groupedActivities, setGroupedActivities] = useState<{ [date: string]: { [time: string]: ProcessGroup[] } }>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const processed = await activityService.getProcessedActivity(view, selectedDate);
                setProcessedActivities(processed);

                const grouped = await activityService.getGroupedActivity(view, selectedDate);
                setGroupedActivities(grouped);

                setLoading(false);
            } catch (error) {
                console.error('Error fetching activity data:', error);
                setLoading(false);
            }
        };

        fetchData();
    }, [view, selectedDate]);

    const changeView = (newRange: 'day' | 'week' | 'month') => {
        setView(newRange);
    };

    const changeDate = (newDate: Date) => {
        setSelectedDate(newDate);
    };

    return (
        <ActivityContext.Provider value={{
            processedActivities,
            groupedActivities,
            loading,
            view,
            selectedDate,
            changeView,
            changeDate
        }}>
            {children}
        </ActivityContext.Provider>
    );
}

export const useActivity = () => useContext(ActivityContext);