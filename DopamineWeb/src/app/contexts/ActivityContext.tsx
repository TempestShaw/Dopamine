'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { activityService } from '@/app/services/activityService';
import { ActivityContextType, TimeSession, GroupedData, ProcessGroup } from '../types';

interface ExtendedActivityContextType {
    rawActivities: TimeSession[][];
    processedActivities: GroupedData;
    groupedActivities: {[date: string]: { [hour: string]: ProcessGroup[] }};
    loading: boolean;
}

const ActivityContext = createContext<ExtendedActivityContextType>({
    rawActivities: [],
    processedActivities: {},
    groupedActivities: {},
    loading: true
});

export function ActivityProvider({ children }: { children: ReactNode }) {
    const [rawActivities, setRawActivities] = useState<TimeSession[][]>([]);
    const [processedActivities, setProcessedActivities] = useState<GroupedData>({});
    const [groupedActivities, setGroupedActivities] = useState<{ [date: string]: { [hour: string]: ProcessGroup[] }}>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const today = new Date();
                
                const activity = await activityService.getDayActivity(today);
                setRawActivities([activity]);

                const processed = await activityService.getProcessedDayActivity(today);
                setProcessedActivities(processed);

                const grouped = await activityService.getGroupedDayActivity(today);
                setGroupedActivities(grouped);

                setLoading(false);
            } catch (error) {
                console.error('Error fetching activity data:', error);
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    return (
        <ActivityContext.Provider value={{
            rawActivities,
            processedActivities,
            groupedActivities,
            loading
        }}>
            {children}
        </ActivityContext.Provider>
    );
}

export const useActivity = () => useContext(ActivityContext);