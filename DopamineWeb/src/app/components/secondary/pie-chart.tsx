import { Cell, Label, Legend, Pie, PieChart, Tooltip } from 'recharts';
type ChartData = {
  name: string;
  value: number;
}[];
export default function PieChartComponent(data: {data:ChartData}) {
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
        //@ts-ignore
        const renderLabel = (props) => {
            const RADIAN = Math.PI / 180
            const { cx, cy, midAngle, outerRadius, fill, percent, value } = props
            const sin = Math.sin(-RADIAN * midAngle)
            const cos = Math.cos(-RADIAN * midAngle)
            const sx = cx + outerRadius * cos
            const sy = cy + outerRadius * sin
            const mx = cx + (outerRadius + 15) * cos
            const my = cy + (outerRadius + 15) * sin
            const ex = mx + (cos >= 0 ? 1 : -1) * 42
            const ey = my
            const textAnchor = cos >= 0 ? 'start' : 'end'
            return (
              <g>
                <path
                  d={`M${sx} ${sy} L${mx} ${my} L${ex} ${ey}`}
                  stroke={colors[props.index % colors.length]}
                  fill="none"
                />
                <text x={cx} y={cy} dy={8} textAnchor="middle" fill='#000000'>
                    {`Total: ${data.data.reduce((acc, curr) => acc + curr.value, 0)}`}
                </text>
                <text
                  x={ex + (cos >= 0 ? 1 : -1) * 5}
                  y={ey}
                  textAnchor={textAnchor}
                  fill={colors[props.index % colors.length]}
                >{props.name}</text>
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
            )
          }
          
return (


<PieChart width={730} height={500}>
<Pie data={data.data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={100} outerRadius={200} label={renderLabel}>
{data.data.map((entry, index) => (

  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />

))}

</Pie>
</PieChart>
    )
}