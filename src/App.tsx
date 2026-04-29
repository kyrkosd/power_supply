import React from 'react'
import { Toolbar } from './components/Toolbar/Toolbar'
import { InputPanel } from './components/InputPanel/InputPanel'
import { SchematicView } from './components/SchematicView/SchematicView'
import { TabPanel } from './components/TabPanel/TabPanel'
import styles from './App.module.css'

export default function App(): React.ReactElement {
  return (
    <div className={styles.shell}>
      <Toolbar />
      <div className={styles.workspace}>
        {/* Left sidebar */}
        <aside className={styles.sidebar}>
          <InputPanel />
        </aside>

        {/* Right content area */}
        <div className={styles.content}>
          <div className={styles.schematicArea}>
            <SchematicView />
          </div>
          <div className={styles.tabArea}>
            <TabPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
