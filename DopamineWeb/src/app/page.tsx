'use client'
import { useState } from 'react';
import Image from "next/image";
import Header from "./components/header";
import Sidebar from "./components/sidebar";
const data = {
  "daily": [
    {
      "title": "Focus hours",
      "number": 10,
      "unit": "hours",
      "description": "focusing on the project"
    },
    {
      "title": "focus hours",
      "number": 10,
      "unit": "hours",
      "description": "focusing on the project"
    },
    {
      "title": "focus hours",
      "number": 10,
      "unit": "hours",
      "description": "focusing on the project"
    },

  ]
}
export default function Home() {
  const [activeTab, setActiveTab] = useState('tab1');

  return (
    <div className="">
      <Header />
      <main className="flex">
        <Sidebar />
        <div className="flex flex-col items-center bg-base-300 w-full">
          <div className="m-2 mt-0 p-4 bg-base-100 w-full">
            <div className="p-2 text-3xl">Today's Dashboard</div>
            <div role="tablist" className="tabs tabs-box">
              <a
                role="tab"
                className={`tab ${activeTab === 'tab1' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('tab1')}
              >
                OKR
              </a>
              <a
                role="tab"
                className={`tab ${activeTab === 'tab2' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('tab2')}
              >
                Tab 2
              </a>
              <a
                role="tab"
                className={`tab ${activeTab === 'tab3' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('tab3')}
              >
                Tab 3
              </a>
            </div>

            {activeTab === 'tab1' && (
              <div>
                <div className="justify-self-center m-4 text-2xl">Daily Data</div>
                <div className="flex flex-col flex-wrap md:flex-row gap-4">
                  {data.daily.map((items) => (
                    <div className="flex flex-col gap-1.5 p-4 bg-base-200 grow md:basis-[calc(33.333%-1rem)] rounded-lg">
                      <div className="">{items.title}</div>
                      <div className='text-3xl'><span className='text-primary'>{items.number}</span> {items.unit}</div>
                      <div className='text-sm'>{items.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'tab2' && (
              <div>Tab 2 Content</div>
            )}

            {activeTab === 'tab3' && (
              <div>Tab 3 Content</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
