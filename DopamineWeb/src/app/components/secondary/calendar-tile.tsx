import { activityService } from "@/app/services/activityService";
import { useState, useEffect } from "react";

interface CalendarTileProps {
    date: Date;
    view: 'month' | 'year' | 'decade' | 'century';
}

export default function CalendarTile({ date, view }: CalendarTileProps) {
    const [activityData, setActivityData] = useState<{[key: string]: number}>({});

    useEffect(() => {
        const fetchData = async () => {
            switch(view) {
                case 'month': {
                    const summary = await activityService.getActivitySummary("day", date);
                    const dateKey = date.toISOString().split('T')[0];
                    setActivityData({[dateKey]: summary.total/1000/60/60});
                    break; 
                }
                default:
                    setActivityData({});
            }
        };
        fetchData();
    }, [date, view]);

    const getLevel = (date: Date) => {
        const dateKey = date.toISOString().split('T')[0];
        const total = activityData[dateKey] || 0;
        return getActivityLevel(total, getMaxValue(view));
    };

    const renderContent = () => {
        const level = getLevel(date);
        switch(view) {
            case 'month':
                return (
                    <div 
                        className={`
                            ${getColorClass(level)} 
                            rounded-md w-4 h-4
                            flex items-center justify-center 
                            transition-all duration-200 ease-in-out
                            group
                            cursor-pointer
                            backdrop-blur-sm
                        `}
                    >
                        <div className="text-sm font-medium group-hover:scale-110 transition-all duration-100">
                            {date.getDate()}
                            
                            </div>
                    </div>
                );
            case 'year':
                return (
                    <div 
                        className={`
                            ${getColorClass(level)}
                            rounded-lg w-16 h-16 
                            flex items-center justify-center 
                            transition-all duration-200 ease-in-out
                            group
                            cursor-pointer
                            backdrop-blur-sm
                        `}
                    >
                        <div className="text-sm font-medium group-hover:scale-110 transition-all duration-100">
                            {date.toLocaleString('en-US', { month: 'short' })}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    const getMaxValue = (view: string) => {
        switch(view) {
            case 'month': return 12;  // 12小时
            case 'year': return 288;  // 24日 * 12小时
            case 'decade': return 2400;  // ~10年
            default: return 12;
        }
    };

    const getActivityLevel = (total: number, maxValue: number) => {
        if (!total) return 0;
        const percentage = (total / maxValue) * 100;
        if (percentage < 15) return 1;
        if (percentage < 30) return 2;
        if (percentage < 45) return 3;
        if (percentage < 60) return 4;
        if (percentage < 75) return 5;
        return 6;
    };

    const getColorClass = (level: number) => {
        switch(level) {
            case 0: return '';  
            case 1: return 'bg-[#9be9a8]';
            case 2: return 'bg-[#40c463]';
            case 3: return 'bg-[#30a14e]';
            case 4: return 'bg-[#216e39]'; 
            case 5: return 'bg-[#164c25]';
            case 6: return 'bg-[#0a3315]';
            default: return '';
        }
    };

    return renderContent();
}