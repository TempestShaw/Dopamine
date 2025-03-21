import { useActivity } from "../contexts/ActivityContext";
import { formatDuration } from "@/lib/utils";
export default function StreamSection() {
    const { processedActivities } = useActivity();
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
            {Object.entries(processedActivities).map(([date, timelines]) => (
                <div key={date} className="space-y-4">
                    <h3 className="text-lg text-base-content font-semibold">{date}</h3>
                    {Object.entries(timelines).map(([time, processes]) => {
                        
                        return (
                            <div key={time} className="space-y-4 border-l-2 border-base-300 pl-4">
                                <div className="text-sm text-base-content/70 mb-2">{time}</div>
                                <div className="space-y-4">
                                    {processes.map((process, processIndex) => (
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
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}