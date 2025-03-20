'use client'
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { activityService } from './services/activityService';
import { useState } from 'react';
import Header from "./components/header";
import Sidebar from "./components/sidebar";
import PieChartComponent from './components/secondary/pie-chart';
import StreakCalendar from './components/secondary/streakcalendar';

const streamData = [
    {
      "time": '8:04',
      "activities": [
        {
          processName: "chrome",
          behaviors: [
            {
              title: "Past paper",
              duration: 10,
              categories: "Working"
            },
            {
              title: "ABC-Youtube",
              duration: 20,
              categories: "Entertainment"
            },
          ]
        },
        {
          processName: "discord",
          behaviors: [
            {
              title: "artrmis",
              duration: 30,
              categories: "Entertainment"
            },
            {
              title: "GRE 333",
              duration: 40,
              categories: "Entertainment"
            },
          ]
        },
      ],
    },
    {
      "time": '8:17',
      "activities": [
        {
          processName: "chrome",
          behaviors: [
            {
              title: "Past paper",
              duration: 10,
              categories: "Working"
            },
            {
              title: "ABC-Youtube",
              duration: 20,
              categories: "Entertainment"
            },
          ]
        },
        {
          processName: "discord",
          behaviors: [
            {
              title: "artrmis",
              duration: 30,
              categories: "Entertainment"
            },
            {
              title: "GRE 333",
              duration: 40,
              categories: "Entertainment"
            },
          ]
        },
      ]
    }];

const data = {
  "daily": {
    "aiMessage": [
      { text: "ABCD" },
      { text: "ABCD" },
      { text: "ABCD" },
    ]
  },
  "charts": [
    {
      "name": "Group A",
      "value": 400
    },
    {
      "name": "Group B",
      "value": 300
    },
    {
      "name": "Group C",
      "value": 300
    },
    {
      "name": "Group D",
      "value": 200
    },
    {
      "name": "Group E",
      "value": 278
    },
    {
      "name": "Group F",
      "value": 189
    }
  ]
}


export default function Home() {
  const [activeTab, setActiveTab] = useState('Stream');
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const isConnected = await activityService.isAuthenticated();
      const isHealthy = await activityService.healthCheck();
      if (!isConnected || !isHealthy) {
        // router.push("/login");
      }
    };
    checkAuth();
  }, [router]);

  return (
    <div className="">
      <Header />
      <main className="flex p-4 h-[calc(100vh-64px)] bg-base-300">
        <div className='flex-1/5 bg-base-100'>
          <div className='flex flex-col h-full justify-between'>
            <StreakCalendar />
            <Sidebar />
          </div>
        </div>
        <div className="flex flex-2/5 flex-col items-center ">
          <div className="p-4 bg-base-100 h-full w-full">
            <div role="tablist" className="tabs tabs-box w-fit ml-auto">
              <a
                role="tab"
                className={`text-base-content tab ${activeTab === 'Stream' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('Stream')}
              >
                Stream
              </a>
              <a
                role="tab"
                className={`text-base-content tab ${activeTab === 'Grouped' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('Grouped')}
              >
                Grouped
              </a>

            </div>

            {activeTab === 'Stream' && (
              <div>
                <div className="mt-4 flex flex-col flex-wrap gap-4">
                  {streamData.map((items, index) => (
                    // <div className="flex flex-col gap-1.5 p-4 bg-base-200 grow md:basis-[calc(33.333%-1rem)] rounded-lg" key={index}>
                    //   <div className="text-strong">{items.title}</div>
                    //   <div className=''><span className='text-primary text-3xl'>{items.number}</span> {items.unit}</div>
                    //   <div className='text-sm'>{items.description}</div>
                    // </div>
                    <div></div>
                  ))}
                </div>

              </div>
            )}

            {activeTab === 'Grouped' && (
              <></>

            )}



          </div>
        </div>
        <div className='bg-base-100'>
          <div className='flex flex-col rounded-lg p-4 gap-1.5 bg-base-200'>
            <div className='flex items-center justify-center w-full'>
              <PieChartComponent data={data.charts} />
            </div>
            <div className='text-strong'>AI Insights</div>
            {data.daily.aiMessage.map((items, index) => (
              <div key={index} className='w-full bg-base-300 rounded-sm p-2'>{items.text}</div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
