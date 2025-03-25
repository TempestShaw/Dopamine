/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'
import { JSX } from 'react';
import { Cell, Pie, PieChart } from 'recharts';

type ChartData = {
  name: string;
  value: number;
}[];

interface PieChartProps {
  data: ChartData;
  width?: number;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  label?: boolean;
  labelLine?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderCustomLabel?: (props: any) => JSX.Element;
}

export default function PieChartComponent({ 
  data, 
  width = 400, 
  height = 500, 
  innerRadius = 50,
  outerRadius = 100,
  label = true,
  labelLine = true,
  renderCustomLabel 
}: PieChartProps) {

  const getChartColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'work':
        return '#3b82f6';  // blue-500
      case 'study':
        return '#22c55e';  // green-500
      case 'social':
        return '#a855f7';  // purple-500
      default:
        return '#9ca3af';  // gray-400
    }
  };

  const colors = [
    '#f0c8ca',
    '#5fb05a',
    '#cadc61',
    '#5880ba',
    '#abc5dc',
    '#ff9999',
    '#99ff99',
    '#9999ff',
    '#ffff99',
    '#ff99ff'
  ];

  // @ts-expect-error - Recharts label prop type is not fully typed
  const defaultRenderLabel = (props) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, outerRadius } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + outerRadius * cos;
    const sy = cy + outerRadius * sin;
    const mx = cx + (outerRadius + 15) * cos;
    const my = cy + (outerRadius + 15) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 42;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';
    return (
      <g>
        <text x={cx} y={cy} dy={8} textAnchor="middle" fill='#000000'>
          {`Total: ${data.reduce((acc, curr) => acc + curr.value, 0)}`}
        </text>
        <text
          x={ex + (cos >= 0 ? 1 : -1) * 5}
          y={ey}
          textAnchor={textAnchor}
          fill={colors[props.index % colors.length]}
        >
          {props.name}
        </text>
        <text
          x={ex + (cos >= 0 ? 1 : -1) * 12}
          y={ey}
          dy={18}
          textAnchor={textAnchor}
          fill={colors[props.index % colors.length]}
        >
          {props.value}
        </text>
      </g>
    );
  };

  return (
    <PieChart width={width} height={height}>
      <Pie 
        data={data} 
        dataKey="value" 
        nameKey="name" 
        cx="50%" 
        cy="50%" 
        innerRadius={innerRadius} 
        outerRadius={outerRadius}
        labelLine={labelLine}
        label={label ? (renderCustomLabel || defaultRenderLabel) : false}
      >
        {data.map((entry, index) => (
          <Cell 
            key={`cell-${index}`} 
            fill={getChartColor(entry.name)}
            opacity={0.5}
          />
        ))}
      </Pie>
    </PieChart>
  );
}