'use client'
import Calendar from "react-calendar";
import CalendarTile from "./calendar-tile";
import { useActivity } from '@/app/contexts/ActivityContext';
import { useEffect, useState } from 'react';
import { activityService } from "@/app/services/activityService";

export default function StreakCalendar() {
    const { loading, processedActivities , changeDate, selectedDate } = useActivity();
    const [activeView, setActiveView] = useState<'day' | 'month'>('day');
    const [activityData, setActivityData] = useState<{[key: string]: number}>({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const TimeTotal: { [TimeUnit: string]:  number } = {};
                const summary = await activityService.getActivitySummary(processedActivities);
                Object.entries(summary).forEach(([key, summary]) => {
                    TimeTotal[key] = summary.total;
                });
                setActivityData(TimeTotal);
                console.log(TimeTotal)
            } catch (error) {
                console.error('Error fetching activity data:', error);
            }
        };
        
        fetchData();
    }, [processedActivities, selectedDate]);

    if (loading) {
        return <div>Loading...</div>;
    }

    const handleViewChange = (view: 'day' | 'month') => {
        setActiveView(view);
    };

    return (
        <div className="flex flex-col gap-4 p-4">
             <div className={`collapse bg-base-100 border-base-300 border ${activeView !== 'month' ? 'collapse-close' : ''}`}>
                <input 
                    type="checkbox" 
                    checked={activeView === 'month'}
                    onChange={() => handleViewChange('month')}
                />
                <div className="collapse-title font-semibold">
                    Monthly View
                </div>
                <div className="collapse-content">
                    <Calendar 
                        locale='en-US'
                        calendarType='iso8601'
                        className="" 
                        tileClassName="p-3 flex justify-center"
                        minDetail="year"
                        maxDetail="year"
                        tileContent={({ date, view }) => 
                            <CalendarTile 
                                date={date} 
                                view={view} 
                                activityData={activityData}
                            />
                        } 
                    />
                </div>
            </div>
            <div className={`collapse bg-base-100 border-base-300 border ${activeView !== 'day' ? 'collapse-close' : ''}`}>
                <input 
                    type="checkbox" 
                    checked={activeView === 'day'}
                    onChange={() => handleViewChange('day')}
                />
                <div className="collapse-title font-semibold">
                    Daily View
                </div>
                <div className="collapse-content">
                    <Calendar 
                        locale='en-US'
                        calendarType='iso8601'
                        className="" 
                        tileClassName="p-3 flex justify-center"
                        minDetail="year"
                        showWeekNumbers={true}
                        onClickDay={(date) => changeDate(date)}
                        tileContent={({ date, view }) => 
                            <CalendarTile 
                                date={date} 
                                view={view}
                                activityData={activityData}
                            />
                        } 
                    />
                </div>
            </div>
        </div>
    );
}