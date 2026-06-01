; 卸载时询问是否保留用户数据
!macro customUnInit
  MessageBox MB_YESNO|MB_ICONQUESTION "是否同时删除所有便签数据？$\n$\n选"是"将删除 %APPDATA%\Stiky\ 下的便签、中转站文件和设置。$\n选"否"将保留数据，下次安装后可恢复。" IDYES deleteData IDNO keepData
  deleteData:
    RMDir /r "$APPDATA\Stiky"
  keepData:
!macroend
