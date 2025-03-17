
type CalendarData = {
    date: string;
    work: number;
    study: number;
    social: number;
    other: number;
    total: number;
}

interface CalendarTileProps {
    activeStartDate: Date;
    date: Date;
    view: 'month' | 'year' | 'decade' | 'century';
    data: CalendarData[];
}

export default function CalendarTile({ activeStartDate, date, view, data }: CalendarTileProps) {
    const getCurrentDateData = () => {
        switch(view) {
            case 'month':
                // For month view, find exact date match
                return data.find(item => item.date === date.toISOString().split('T')[0]);
            case 'year':
                // For year view, sum up all dates in the same month
                const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
                const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
                const monthData = data.filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate >= monthStart && itemDate <= monthEnd;
                });
                if (monthData.length === 0) return null;
                return {
                    date: date.toISOString().split('T')[0],
                    work: monthData.reduce((sum, item) => sum + item.work, 0),
                    study: monthData.reduce((sum, item) => sum + item.study, 0),
                    social: monthData.reduce((sum, item) => sum + item.social, 0),
                    other: monthData.reduce((sum, item) => sum + item.other, 0),
                    total: monthData.reduce((sum, item) => sum + item.total, 0)
                };
            case 'decade':
                // For decade view, sum up all dates in the same year
                const yearStart = new Date(date.getFullYear(), 0, 1);
                const yearEnd = new Date(date.getFullYear(), 11, 31);
                const yearData = data.filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate >= yearStart && itemDate <= yearEnd;
                });
                if (yearData.length === 0) return null;
                return {
                    date: date.toISOString().split('T')[0],
                    work: yearData.reduce((sum, item) => sum + item.work, 0),
                    study: yearData.reduce((sum, item) => sum + item.study, 0),
                    social: yearData.reduce((sum, item) => sum + item.social, 0),
                    other: yearData.reduce((sum, item) => sum + item.other, 0),
                    total: yearData.reduce((sum, item) => sum + item.total, 0)
                };
            default:
                return null;
        }
    };

    const currentDateData = getCurrentDateData();
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

    const level = currentDateData?.total 
        ? getActivityLevel(currentDateData.total, getMaxValue(view))
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
            // case 'decade':
            //     return (
            //         <div className={`${getColorClass(level)} rounded-full w-12 h-12 flex items-center justify-center`}>

            //             {level}
            //         </div>
            //     ); Decade has problem of showing data
            default:
                return null;
        }
    };

    return renderContent();
}