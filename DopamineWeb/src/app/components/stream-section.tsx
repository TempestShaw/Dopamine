import { TimeSession } from "../types"
import { format } from 'date-fns';

interface StreamSectionProps {
    streamData: TimeSession[][];
}

export default function StreamSection({ streamData }: StreamSectionProps) {
    const getActivityColor = (category: string) => {
        switch (category.toLowerCase()) {
            case 'work':
                return 'bg-blue-500';
            case 'study':
                return 'bg-green-500';
            case 'social':
                return 'bg-purple-500';
            default:
                return 'bg-gray-400';
        }
    };

    return (
        <div className="space-y-8 p-4">
            {streamData.map((daily, dayIndex) => (
                <div key={dayIndex} className="p-4">
                    <h3 className="text-lg font-semibold mb-4">
                        {daily.length > 0 && daily[0].time.split('T')[0]}
                    </h3>
                    {daily.map((session, sessionIndex) => (
                                session.activities.map((activity, activityIndex) => (
                                    activity.behavior.map((behavior, behaviorIndex) => {
                                        const timeHour = parseInt(session.time.split('T')[0].split(':')[0]);
                                        const timeMinute = parseInt(session.time.split('T')[0].split(':')[1]);
                                        
                                        return (
                                            <div
                                                key={`${sessionIndex}-${activityIndex}-${behaviorIndex}`}
                                                className={` ${getActivityColor(behavior.category)} 
                                                    opacity-75 hover:opacity-100 transition-opacity cursor-pointer
                                                    rounded px-2 py-1 text-xs text-white overflow-hidden`}

                                                title={`${activity.processName} - ${behavior.title}\nDuration: ${behavior.duration} minutes`}
                                            >
                                                {behavior.duration > 30 && (
                                                    <>
                                                        <div className="font-semibold">{activity.processName}</div>
                                                        <div className="text-xs truncate">{behavior.title}</div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })
                                ))
                            ))}
                </div>
            ))}
        </div>
    );
}