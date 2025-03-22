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
import { motion, AnimatePresence } from 'framer-motion';

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
        <div className='flex-1/12 bg-base-100'>
          <div className='flex flex-col h-full justify-between'>
            <StreakCalendar />
            <Sidebar />
          </div>
        </div>
        <div className="flex flex-8/12 flex-col items-center">
          <div className="p-4 bg-base-100 h-full w-full flex flex-col">
            <div role="tablist" className="tabs tabs-box w-fit ml-auto shrink-0 relative p-1 bg-base-200/30 backdrop-blur-md rounded-xl">
              <motion.div 
                className="absolute bg-base-200 backdrop-blur-sm rounded-sm shadow-sm" 
                initial={false}
                animate={{ 
                  x: activeTab === 'Grouped' ? '100%' : '0%',
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30
                }}
                style={{ 
                  left: '4px', 
                  top: '4px',
                  width: 'calc(50% - 4px)', 
                  height: 'calc(100% - 8px)',
                }}
              />
              <a
                role="tab"
                className={`text-base-content tab relative z-10 transition-colors duration-300 min-w-24 ${
                  activeTab === 'Stream' ? 'text-primary' : 'hover:text-primary/70'
                }`}
                onClick={() => setActiveTab('Stream')}
              >
                Stream
              </a>
              <a
                role="tab"
                className={`text-base-content tab relative z-10 transition-colors duration-300 min-w-24 ${
                  activeTab === 'Grouped' ? 'text-primary' : 'hover:text-primary/70'
                }`}
                onClick={() => setActiveTab('Grouped')}
              >
                Grouped
              </a>
            </div>

            <div className="flex-1 min-h-0 relative">
              <div className="absolute inset-0 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <div className="pb-16">
                    <AnimatePresence mode="wait">
                      {activeTab === 'Stream' && (
                        <motion.div
                          key="stream"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.2 }}
                        >
                          <StreamSection />
                        </motion.div>
                      )}

                      {activeTab === 'Grouped' && (
                        <motion.div
                          key="grouped"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.2 }}
                        >
                          <GroupSection />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
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
