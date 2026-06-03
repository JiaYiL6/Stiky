; 卸载时询问是否保留用户数据
!macro customUnInit
  MessageBox MB_YESNO|MB_ICONQUESTION "是否保留便签数据？$\n选「是」保留，选「否」删除" IDYES keepData
    RMDir /r "$APPDATA\Stiky"
  keepData:
!macroend
