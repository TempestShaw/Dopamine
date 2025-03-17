'use client'
import { useState } from 'react';
import Image from "next/image";
import Header from "./components/header";
import Sidebar from "./components/sidebar";
import PieChartComponent from './components/secondary/pie-chart';
const data = {
  "daily": {
      "cards": [
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
      ],
      "aiMessage":[
        {text:"ABCD"},
        {text:"ABCD"},
        {text:"ABCD"},
      ]
  },
  "charts":[
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
                App Usage
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
                <div className="mt-4 flex flex-col flex-wrap md:flex-row gap-4">
                  {data.daily.cards.map((items, index) => (
                    <div className="flex flex-col gap-1.5 p-4 bg-base-200 grow md:basis-[calc(33.333%-1rem)] rounded-lg" key={index}>
                      <div className="text-strong">{items.title}</div>
                      <div className=''><span className='text-primary text-3xl'>{items.number}</span> {items.unit}</div>
                      <div className='text-sm'>{items.description}</div>
                    </div>
                  ))}
                </div>
                <div className='flex flex-col mt-4 gap-1.5'>
                  <div className='text-strong'>AI Insights</div>
                  {data.daily.aiMessage.map((items, index) => (
                    <div key={index} className='w-full bg-base-200 rounded-sm p-2'>{items.text}</div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'tab2' && (
              <div> 
               <PieChartComponent data={data.charts}/>
              </div>
              
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
