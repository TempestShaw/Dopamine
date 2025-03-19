'use client'

import { useEffect, useState } from 'react';
import PairingSession from '../components/secondary/landing/pairing-session';
import DownloadSection from '../components/secondary/landing/download-section';
import { Cell, Pie, PieChart } from 'recharts';
import { activityService } from '../services/activityService';
export default function Login() {
    const sudoData = [{
        name: "Work",
        value: 4
    },
    {
        name: "Social",
        value: 1.5
    },
    {
        name: "Gaming",
        value: 2
    },
    ]
    const colors = [
        '#f0c8ca',
        '#5fb05a',
        '#cadc61',
        '#5880ba',
        '#abc5dc'
    ];
    //@ts-expect-error
    const renderLabel = (props) => {
        const RADIAN = Math.PI / 180
        const { cx, cy, midAngle, outerRadius } = props
        const sin = Math.sin(-RADIAN * midAngle)
        const cos = Math.cos(-RADIAN * midAngle)
        const mx = cx + (outerRadius + 45) * cos
        const my = cy + (outerRadius + 45) * sin
        const textAnchor = cos >= 0 ? 'start' : 'end'
        return (
            <g>

                <text
                    className='text-2xl'
                    x={mx}
                    y={my}
                    textAnchor={textAnchor}
                    fill={colors[props.index % colors.length]}
                >{props.name}</text>
                <text
                    x={mx}
                    y={my}
                    dy={18}
                    textAnchor={textAnchor}
                    fill={colors[props.index % colors.length]}
                >
                    {props.value}
                </text>
            </g>
        )
    }


    const [hasDownloaded, setHasDownloaded] = useState(true);
    useEffect(() => {
        const checkDownloaded = async () => {
            const response = await activityService.healthCheck();
            setHasDownloaded(response);
        };
        checkDownloaded();
    }, []);
    return (
        <div className="min-h-screen flex items-center justify-center bg-base-100">
            <div className='flex flex-row m-16'>
                <div className='flex flex-2/3 flex-col justify-evenly items-start'>
                    <div className='flex flex-col pl-4'>
                        <h1 className='text-6xl mb-6'>
                            Dopamine
                        </h1>
                        <h2 className='text-2xl'>
                            Rediscover your time
                        </h2>
                    </div>
                    {hasDownloaded ? (
                        <PairingSession />
                    ) : (
                        <DownloadSection />
                    )}

                </div>
                <PieChart width={530} height={400}>
                    <Pie data={sudoData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} label={renderLabel}>
                        {sudoData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}

                    </Pie>
                </PieChart>
            </div>
        </div>
    );
}