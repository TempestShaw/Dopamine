'use client'
import Calendar from "react-calendar";
import CalendarTile from "./calendar-tile";
import { useActivity } from '@/app/contexts/ActivityContext';

export default function StreakCalendar() {
    const { rawActivities, loading } = useActivity();

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="flex justify-center">
            <Calendar 
                locale='en-US'
                calendarType='iso8601'
                className="" 
                tileClassName="p-3 flex justify-center" 
                tileContent={({ date, view }) => 
                    <CalendarTile 
                        date={date} 
                        view={view} 
                        data={rawActivities}
                    />
                } 
            />
        </div>
    );
}