import { useActivity } from "../contexts/ActivityContext";
import { formatDuration } from "@/lib/utils";
import PieChartComponent from "./secondary/pie-chart";
import { activityService } from "../services/activityService";

export default function GroupSection() {
    const { groupedActivities, view } = useActivity();
    const getActivityColor = (category: string) => {
        switch (category.toLowerCase()) {
            case 'work':
                return 'bg-blue-500/50';
            case 'study':
                return 'bg-green-500/50';
            case 'social':
                return 'bg-purple-500/50';
            default:
                return 'bg-gray-400/50';
        }
    };

    return (
        <div className="space-y-8">
            {Object.entries(groupedActivities)
                .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                .map(([date, timelyData]) => (
                    <div key={date} className="space-y-4">
                        <h2 className="text-lg text-base-content font-semibold">{date}</h2>
                        <div className="space-y-4">
                            {Object.entries(timelyData)
                                .sort(([hourA], [hourB]) => {
                                    const hourNumA = parseInt(hourA);
                                    const hourNumB = parseInt(hourB);
                                    return hourNumA - hourNumB;
                                })
                                .map(([timeUnit, processes]) => {
                                    const sortedProcesses = [...processes].sort((a, b) => {
                                        const totalA = Object.values(a.summary).reduce((sum, val) => sum + val, 0);
                                        const totalB = Object.values(b.summary).reduce((sum, val) => sum + val, 0);
                                        return totalB - totalA;
                                    });

                                    return (
                                        <div key={timeUnit} className="space-y-4 border-l-2 border-base-300 pl-4">
                                            <h3 className="text-sm text-base-content/70 mb-2">
                                                {view === 'day' ? `${timeUnit.padStart(2, '0')}:00 - ${timeUnit.padStart(2, '0')}:59` : `${timeUnit}`}
                                            </h3>
                                            <div className="space-y-4 flex flex-col">
                                                
                                               
                                                <div className="flex flex-row flex-wrap">
                                                <PieChartComponent
                                                    data={Object.entries(activityService.getCategorySummary(processes))
                                                        .filter(([key]) => key !== 'total')
                                                        .map(([name, value]) => ({
                                                            name,
                                                            value: Number((Number(value) / 1000 / 60 / 60).toFixed(1))
                                                        }))}
                                                    width={200}
                                                    height={100}
                                                    innerRadius={20}
                                                    outerRadius={40}
                                                    label={true}
                                                    labelLine={false}
                                                    renderCustomLabel={({ cx, cy, midAngle, innerRadius, outerRadius, value, name }) => {
                                                        const RADIAN = Math.PI / 180;
                                                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                        const y = cy + radius * Math.sin(-midAngle * RADIAN);

                                                        return (
                                                            <g>
                                                                <text x={cx} y={cy} dy={8} className="text-xs" textAnchor="middle" fill="currentColor">
                                                                    {`Total: ${Object.entries(activityService.getCategorySummary(processes))
                                                                        .filter(([key]) => key !== 'total')
                                                                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                                                        .reduce((acc, [_, value]) => acc + Number((Number(value) / 1000 / 60 / 60).toFixed(1)), 0)}h`}
                                                                </text>
                                                                {value > 0 && (
                                                                    <text
                                                                        x={x}
                                                                        y={y}
                                                                        fill="currentColor"
                                                                        textAnchor={x > cx ? 'start' : 'end'}
                                                                        dominantBaseline="central"
                                                                        className="text-xs"
                                                                    >
                                                                        {`${name} (${value}h)`}
                                                                    </text>
                                                                )}
                                                            </g>
                                                        );
                                                    }}
                                                />
                                                    {sortedProcesses.map((process, processIndex) => {
                                                        if (process.processName === "<Dopamine>" &&
                                                            process.behaviors.some(b => b.title === "<Stopped>")) {
                                                            return null;
                                                        }
                                                        return (
                                                            <div key={processIndex} className="p-2">
                                                                <div className="font-medium text-base-content">
                                                                    {process.processName}
                                                                    <span className="text-xs ml-2 text-base-content/50">
                                                                        {formatDuration(Object.values(process.summary).reduce((sum, val) => sum + val, 0))}
                                                                    </span>
                                                                </div>
                                                                <div className="grid">
                                                                    {process.behaviors.map((behavior, behaviorIndex) => (
                                                                        <div
                                                                            key={behaviorIndex}
                                                                            className={`p-2 rounded text-sm text-base-content`}
                                                                        >
                                                                            <div className={`${getActivityColor(behavior.category)} font-medium min-w-[300px]`}>
                                                                                {behavior.title}
                                                                            </div>
                                                                            <div className="text-xs opacity-75">
                                                                                {formatDuration(behavior.duration)}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )

                                                    })}
                                                </div>
                                                {processes.some(p => p.processName === "<Dopamine>" &&
                                                    p.behaviors.some(b => b.title === "<Stopped>")) && (
                                                        <div className="w-full">
                                                            <div className="border-t-2 border-base-300 relative">
                                                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-base-100 px-2 text-xs text-base-content/50">
                                                                    Stopped
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                ))}
        </div>
    );
}