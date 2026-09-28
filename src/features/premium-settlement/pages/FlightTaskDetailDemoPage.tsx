import { useEffect } from 'react';
import TaskManagementPage from './TaskManagementPage';

const DEFAULT_TASK_ID = 'FT410423200025';

export default function FlightTaskDetailDemoPage() {
  useEffect(() => { document.title = '起飞任务详情'; }, []);
  return <TaskManagementPage initialTaskId={DEFAULT_TASK_ID} />;
}
