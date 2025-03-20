'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { activityService } from '@/app/services/activityService';
import { ActivityContextType, TimeSession } from '../types';



const ActivityContext = createContext<ActivityContextType>({ activities: [], loading: true });

export function ActivityProvider({ children }: { children: ReactNode }) {
    const [activities, setActivities] = useState<TimeSession[][]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDayData = async () => {
            const today = new Date();
            const activity = await activityService.getDayActivity(today);
            const newActivities = [activity];
            

            setActivities(newActivities);
            setLoading(false);
        };

        fetchDayData();
    }, []);

    return (
        <ActivityContext.Provider value={{ activities, loading }}>
            {children}
        </ActivityContext.Provider>
    );
}

export const useActivity = () => useContext(ActivityContext);