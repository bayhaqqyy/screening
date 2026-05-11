import React from 'react';
import { Outlet } from 'react-router-dom';
import TopNavBar from './TopNavBar';
import SideNavBar from './SideNavBar';
import AlertNotification from './AlertNotification';

const AppLayout = () => {
  return (
    <>
      <TopNavBar />
      <SideNavBar />
      
      {/* Main Canvas */}
      <main className="ml-60 pt-14 h-screen overflow-y-auto bg-surface">
        <div className="p-8 max-w-[1600px] mx-auto space-y-8">
          <Outlet />
          <AlertNotification />
        </div>
      </main>
    </>
  );
};

export default AppLayout;
