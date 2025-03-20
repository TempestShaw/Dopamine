import { TimeSession } from "../types"

interface StreamSectionProps {
    streamData: TimeSession[][];
}
interface ProcessBehavior {
    title: string;
    duration: number;
    category: string;
}

interface ProcessGroup {
    processName: string;
    behaviors: ProcessBehavior[];
}
interface DailyData {
    [time: string]: ProcessGroup[];
}

interface GroupedData {
    [date: string]: DailyData;
}
export default function StreamSection({ streamData }: StreamSectionProps) {
    const StreamViewData = (streamData: TimeSession[][]) => {
        const groupedData: GroupedData = {};
        streamData.forEach((daily) => {
            groupedData[daily[0].time.split('T')[0]] = {};
            daily.forEach((session) => {
                const time = session.time.split('T')[1];
                groupedData[daily[0].time.split('T')[0]][time] = [];
                session.activities.forEach((process) => {
                    if (!groupedData[daily[0].time.split('T')[0]][time].find((group) => group.processName === process.processName)) {
                        groupedData[daily[0].time.split('T')[0]][time].push({
                            processName: process.processName,
                            behaviors: []
                        });
                    }
                   process.behavior.forEach((behavior) => {
                        if (!groupedData[daily[0].time.split('T')[0]][time].find((group) => group.processName === process.processName)?.behaviors.find((b) => b.title === behavior.title)) {
                            groupedData[daily[0].time.split('T')[0]][time].find((group) => group.processName === process.processName)!.behaviors.push(behavior);
                        }
                        else {
                            groupedData[daily[0].time.split('T')[0]][time].find((group) => group.processName === process.processName)!.behaviors.find((b) => b.title === behavior.title)!.duration += behavior.duration;
                        }
                    });
                });
            });
        });
        return groupedData;
    };
    const groupedData = StreamViewData(streamData);
    console.log(groupedData);
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
        <div className="space-y-8 p-2">
            {streamData.map((daily, dayIndex) => (
                <div key={dayIndex} className="">
                    <h3 className="text-lg font-semibold mb-4 border-b-2">
                        {daily.length > 0 && daily[0].time.split('T')[0]}
                    </h3>
                    {daily.map((session, sessionIndex) => (
                                session.activities.map((activity, activityIndex) => (
                                    activity.behavior.map((behavior, behaviorIndex) => {

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