import { useActivity } from "../contexts/ActivityContext";
import { formatDuration } from "@/lib/utils";

export default function GroupSection() {
    const { groupedActivities } = useActivity();
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
        <div className="space-y-8 p-2">
            {Object.entries(groupedActivities)
                .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                .map(([date, hourlyData]) => (
                    <div key={date} className="space-y-4">
                        <h2 className="text-lg font-semibold">{date}</h2>
                        <div className="space-y-4">
                            {Object.entries(hourlyData)
                                .sort(([hourA], [hourB]) => {
                                    const hourNumA = parseInt(hourA);
                                    const hourNumB = parseInt(hourB);
                                    return hourNumA - hourNumB;
                                })
                                .map(([hour, processes]) => {
                                    const sortedProcesses = [...processes].sort((a, b) => {
                                        const totalA = Object.values(a.summary).reduce((sum, val) => sum + val, 0);
                                        const totalB = Object.values(b.summary).reduce((sum, val) => sum + val, 0);
                                        return totalB - totalA;
                                    });
                                    return (
                                        <div key={hour} className="space-y-4 border-l-2 border-base-300 pl-4">
                                            <h3 className="text-sm text-base-content/70 mb-2">
                                                {`${hour.padStart(2, '0')}:00 - ${hour.padStart(2, '0')}:59`}
                                            </h3>

                                        {sortedProcesses.map((process, processIndex) => (
                                            <div key={processIndex}>
                                                <div className="font-medium text-base-content">
                                                {process.processName}
                                                <span className="text-xs ml-2 text-base-content/50">
                                                    {formatDuration(Object.values(process.summary).reduce((sum, val) => sum + val, 0))}
                                                </span>
                                                </div>
                                              
                                                <div className="grid grid-cols-2 gap-2">
                                                {process.behaviors.map((behavior, behaviorIndex) => (
                                                    <div
                                                        key={behaviorIndex}
                                                        className={`
                                                            p-2 rounded text-sm text-base-content`}
                                                    >
                                                        <div className={`${getActivityColor(behavior.category)} font-medium`}>{behavior.title}</div>
                                                        <div className="text-xs opacity-75">
                                                            {formatDuration(behavior.duration)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            </div>
                                            
                                        ) )}
                                        </div>
                                    )
                                }
                                )
                            }
                        </div>
                    </div>
                ))}
        </div>
    );
}