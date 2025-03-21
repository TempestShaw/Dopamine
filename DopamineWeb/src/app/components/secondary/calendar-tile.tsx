import { activityService } from "@/app/services/activityService";
import { useState, useEffect } from "react";

interface CalendarTileProps {
    date: Date;
    view: 'month' | 'year' | 'decade' | 'century';
}

export default function CalendarTile({ date, view }: CalendarTileProps) {
    const [currentDateData, setCurrentDateData] = useState<number>(0);

    useEffect(() => {
        const fetchData = async () => {
            switch(view) {
                case 'month': {
                    const summary = await activityService.getActivitySummary("day", date);
                    setCurrentDateData(summary.total/1000/60/60);
                }
                case 'year': {
                    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
                    let monthTotal = 0;
                    
                    for (let day = 1; day <= daysInMonth; day++) {
                        const currentDate = new Date(date.getFullYear(), date.getMonth(), day);
                        const summary = await activityService.getActivitySummary("day", currentDate);
                        monthTotal += summary.total;
                    }
                    
                    setCurrentDateData(monthTotal/1000/60/60);
                    break;
                }
                default:
                    setCurrentDateData(0);
            }
        };
        fetchData();
    }, [date, view]);

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

    const level = currentDateData 
        ? getActivityLevel(currentDateData, getMaxValue(view))
        : 0;

    const getColorClass = (level: number) => {
        switch(level) {
            case 0: return 'bg-[#e6e9ef]';  
            case 1: return 'bg-[#9be9a8]';
            case 2: return 'bg-[#40c463]';
            case 3: return 'bg-[#30a14e]';
            case 4: return 'bg-[#216e39]'; 
            case 5: return 'bg-[#164c25]';
            case 6: return 'bg-[#0a3315]';
            default: return 'bg-[#e6e9ef]';
        }
    };

    const renderContent = () => {
        switch(view) {
            case 'month':
                return (
                    <div className={`${getColorClass(level)} rounded-full w-6 h-6 flex items-center justify-center`}>
                        {date.getDate()}
                        {/* {level} */}
                    </div>
                );
            case 'year':
                return (
                    <div className={`${getColorClass(level)} rounded-full w-12 h-12 flex items-center justify-center`}>
                        {date.toLocaleString('en-US', { month: 'long' })}
                        {/* {level} */}
                    </div>
                );
            default:
                return null;
        }
    };

    return renderContent();
}