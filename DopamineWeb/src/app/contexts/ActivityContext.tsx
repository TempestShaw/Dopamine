'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { activityService } from '@/app/services/activityService';
import { GroupedData, ProcessGroup } from '../types';
import moment from 'moment';

interface ExtendedActivityContextType {
    processedActivities: GroupedData;
    groupedActivities: { [date: string]: { [time: string]: ProcessGroup[] } };
    view: 'day' | 'week' | 'month';
    selectedDate: Date;
    changeView: (newRange: 'day' | 'week' | 'month') => void;
    changeDate: (newDate: Date) => void;
}

const ActivityContext = createContext<ExtendedActivityContextType>({
    processedActivities: {},
    groupedActivities: {},
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

    useEffect(() => {
        const fetchData = async () => {
            try {
               
                const processed = await activityService.getProcessedActivity(selectedDate);
                setProcessedActivities(processed);
                
                const grouped = await activityService.getGroupedActivity(processed, view, selectedDate);
                setGroupedActivities(grouped);

                console.log({
                    "processed": processed,
                    "grouped": grouped,
                    "view": view,
                    "selectedDate": selectedDate,
                    "locale": selectedDate.toDateString(),
                    "momentDate": moment(selectedDate).format('YYYY-MM-DD')
                })
            } catch (error) {
                console.error('Error fetching activity data:', error);
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