'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { activityService } from '@/app/services/activityService';
import { ActivityContextType, TimeSession } from '../types';



const ActivityContext = createContext<ActivityContextType>({ activities: [], loading: true });

export function ActivityProvider({ children }: { children: ReactNode }) {
    const [activities, setActivities] = useState<TimeSession[][]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMonthData = async () => {
            const today = new Date();
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);

            const newActivities = [];
            for (let d = new Date(monthAgo); d <= today; d.setDate(d.getDate() + 1)) {
                try {
                    const activity = await activityService.getDayActivity(new Date(d));
                    newActivities.push(activity);
                } catch (error) {
                    console.error('Error fetching activity:', error);
                }
            }

            setActivities(newActivities);
            setLoading(false);
        };

        fetchMonthData();
    }, []);

    return (
        <ActivityContext.Provider value={{ activities, loading }}>
            {children}
        </ActivityContext.Provider>
    );
}

export const useActivity = () => useContext(ActivityContext);