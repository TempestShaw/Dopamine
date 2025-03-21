'use client'
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { activityService } from './services/activityService';
import { useState } from 'react';
import Header from "./components/header";
import Sidebar from "./components/sidebar";
import PieChartComponent from './components/secondary/pie-chart';
import StreakCalendar from './components/secondary/streakcalendar';
import StreamSection from './components/stream-section';
import { useActivity } from './contexts/ActivityContext';
import GroupSection from './components/grouped-section';

const activities = [[
  {
    "time": '2024-03-20T08:20',
    "activities": [
      {
        processName: "chrome",
        behavior: [
          {
            title: "Past paper",
            duration: 1000,
            category: "work"
          },
          {
            title: "ABC-Youtube",
            duration: 2000,
            category: "Entertainment"
          },
        ],
        summary: {
          work: 1000,
          Entertainment: 2000,
          study: 0,
          social: 0,
          other: 0,
        }
      },
      {
        processName: "discord",
        behavior: [
          {
            title: "artrmis",
            duration: 3000,
            category: "Entertainment"
          },
          {
            title: "GRE 333",
            duration: 4000,
            category: "Entertainment"
          },
        ],
        summary: {
          work: 0,
          Entertainment: 7000,
          study: 0,
          social: 0,
          other: 0,
        }
      },
    ],
  },
  {
    "time": '2024-03-20T08:23',
    "activities": [
      {
        processName: "chrome",
        behavior: [
          {
            title: "Past paper",
            duration: 1000,
            category: "work"
          },
          {
            title: "ABC-Youtube",
            duration: 2000,
            category: "Entertainment"
          },
        ],
        summary: {
          work: 1000,
          Entertainment: 2000,
          study: 0,
          social: 0,
          other: 0,
        }
      },
      {
        processName: "discord",
        behavior: [
          {
            title: "artrmis",
            duration: 3000,
            category: "Entertainment"
          },
          {
            title: "GRE 333",
            duration: 4000,
            category: "Entertainment"
          },
        ],
        summary: {
          work: 0,
          Entertainment: 7000,
          study: 0,
          social: 0,
          other: 0,
        }
      },
    ]
  }]];

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
  const { loading } = useActivity();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const isConnected = await activityService.isAuthenticated();
      const isHealthy = await activityService.healthCheck();
      if (!isConnected || !isHealthy) {
        router.push("/login");
      }
    };
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

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
              <StreamSection />
            )}

            {activeTab === 'Grouped' && (
              <GroupSection />
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
