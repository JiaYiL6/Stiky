; 卸载时询问是否保留用户数据
!macro customUnInit
  MessageBox MB_YESNO|MB_ICONQUESTION "是否删除 Stiky 所有便签数据？$\n$\n是 = 删除 %APPDATA%\Stiky 下全部数据$\n否 = 保留数据，下次安装后恢复" IDYES deleteData IDNO keepData
  deleteData:
    RMDir /r "$APPDATA\Stiky"
  keepData:
!macroend
